// Lógica de agendamento da Nina, compartilhada entre:
//  - nina-orchestrator (modo lovable: agenda in-process via tool calls do LLM)
//  - nina-tools (modo openclaw: a skill do agente chama de volta esta lógica via Edge Function)
// Extraído de nina-orchestrator/index.ts SEM mudança de comportamento.

// Helper: converte "HH:MM" em minutos.
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Create appointment from AI tool call
export async function createAppointmentFromAI(
  supabase: any,
  contactId: string,
  conversationId: string,
  userId: string | null,
  args: {
    title?: string;
    date: string;
    time: string;
    duration?: number;
    type?: 'demo' | 'meeting' | 'support' | 'followup';
    description?: string;
  }
): Promise<any> {
  console.log('[Nina] Creating appointment from AI:', args, 'for user:', userId);

  // Validate date is not in the past
  const appointmentDate = new Date(`${args.date}T${args.time}:00`);
  const now = new Date();

  if (appointmentDate < now) {
    console.log('[Nina] Attempted to create appointment in the past, skipping');
    return { error: 'date_in_past' };
  }

  // Check for time conflicts (only for this user's appointments)
  const query = supabase
    .from('appointments')
    .select('id, time, duration, title')
    .eq('date', args.date)
    .eq('status', 'scheduled');

  if (userId) {
    query.eq('user_id', userId);
  }

  const { data: existingAppointments } = await query;

  const requestedStart = parseTimeToMinutes(args.time);
  const requestedDuration = args.duration || 60;
  const requestedEnd = requestedStart + requestedDuration;

  for (const existing of existingAppointments || []) {
    const existingStart = parseTimeToMinutes(existing.time);
    const existingEnd = existingStart + (existing.duration || 60);

    // Check for overlap: new appointment starts before existing ends AND new appointment ends after existing starts
    if (requestedStart < existingEnd && requestedEnd > existingStart) {
      console.log('[Nina] Time conflict detected with appointment:', existing.id);
      return {
        error: 'time_conflict',
        conflictWith: existing.time,
        conflictTitle: existing.title
      };
    }
  }

  // appointments.title é NOT NULL e o agente às vezes chama o agendar.sh SEM
  // title -> insert falhava (not-null violation) -> {ok:false} -> Nina "instável".
  // Default robusto: usa o nome do contato; fallback genérico.
  let resolvedTitle = (args.title ?? '').trim();
  if (!resolvedTitle) {
    let contactName = '';
    try {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, call_name')
        .eq('id', contactId)
        .maybeSingle();
      contactName = (contact?.name || contact?.call_name || '').trim();
    } catch (_e) {
      // segue pro fallback genérico
    }
    resolvedTitle = contactName ? `Reunião com ${contactName}` : 'Reunião agendada pela Nina';
  }

  const insertData: any = {
    title: resolvedTitle,
    date: args.date,
    time: args.time,
    duration: args.duration || 60,
    type: args.type,
    description: args.description || null,
    contact_id: contactId,
    status: 'scheduled',
    metadata: {
      source: 'nina_ai',
      conversation_id: conversationId,
      created_at_conversation: new Date().toISOString()
    }
  };

  // Add user_id if available (for RLS compliance)
  if (userId) {
    insertData.user_id = userId;
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[Nina] Error creating appointment:', error);
    return { error: error.message };
  }

  console.log('[Nina] Appointment created successfully:', data.id);
  return data;
}

// Reschedule an existing appointment
export async function rescheduleAppointmentFromAI(
  supabase: any,
  contactId: string,
  userId: string | null,
  args: {
    new_date: string;
    new_time: string;
    reason?: string;
  }
): Promise<any> {
  console.log('[Nina] Rescheduling appointment for contact:', contactId, 'user:', userId, args);

  // Find the most recent scheduled appointment for this contact
  const query = supabase
    .from('appointments')
    .select('*')
    .eq('contact_id', contactId)
    .eq('status', 'scheduled')
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(1);

  if (userId) {
    query.eq('user_id', userId);
  }

  const { data: existingAppointments } = await query;

  if (!existingAppointments || existingAppointments.length === 0) {
    console.log('[Nina] No appointment found to reschedule');
    return { error: 'no_appointment_found' };
  }

  const appointment = existingAppointments[0];

  // Validate new date is not in the past
  const newAppointmentDate = new Date(`${args.new_date}T${args.new_time}:00`);
  const now = new Date();

  if (newAppointmentDate < now) {
    console.log('[Nina] Attempted to reschedule to a past date');
    return { error: 'date_in_past' };
  }

  // Check for conflicts at new time (only for this user's appointments)
  const conflictQuery = supabase
    .from('appointments')
    .select('id, time, duration, title')
    .eq('date', args.new_date)
    .eq('status', 'scheduled')
    .neq('id', appointment.id);

  if (userId) {
    conflictQuery.eq('user_id', userId);
  }

  const { data: conflictingAppointments } = await conflictQuery;

  const requestedStart = parseTimeToMinutes(args.new_time);
  const requestedEnd = requestedStart + (appointment.duration || 60);

  for (const existing of conflictingAppointments || []) {
    const existingStart = parseTimeToMinutes(existing.time);
    const existingEnd = existingStart + (existing.duration || 60);

    if (requestedStart < existingEnd && requestedEnd > existingStart) {
      console.log('[Nina] Time conflict detected at new time');
      return {
        error: 'time_conflict',
        conflictWith: existing.time,
        conflictTitle: existing.title
      };
    }
  }

  // Update the appointment
  const { data, error } = await supabase
    .from('appointments')
    .update({
      date: args.new_date,
      time: args.new_time,
      metadata: {
        ...appointment.metadata,
        rescheduled_at: new Date().toISOString(),
        rescheduled_reason: args.reason || null,
        previous_date: appointment.date,
        previous_time: appointment.time
      }
    })
    .eq('id', appointment.id)
    .select()
    .single();

  if (error) {
    console.error('[Nina] Error rescheduling appointment:', error);
    return { error: error.message };
  }

  console.log('[Nina] Appointment rescheduled successfully:', data.id);
  return { ...data, previous_date: appointment.date, previous_time: appointment.time };
}

// Cancel an existing appointment
export async function cancelAppointmentFromAI(
  supabase: any,
  contactId: string,
  userId: string | null,
  args: {
    reason?: string;
  }
): Promise<any> {
  console.log('[Nina] Canceling appointment for contact:', contactId, 'user:', userId);

  // Find the most recent scheduled appointment for this contact
  const query = supabase
    .from('appointments')
    .select('*')
    .eq('contact_id', contactId)
    .eq('status', 'scheduled')
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(1);

  if (userId) {
    query.eq('user_id', userId);
  }

  const { data: existingAppointments } = await query;

  if (!existingAppointments || existingAppointments.length === 0) {
    console.log('[Nina] No appointment found to cancel');
    return { error: 'no_appointment_found' };
  }

  const appointment = existingAppointments[0];

  // Update status to cancelled
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      metadata: {
        ...appointment.metadata,
        cancelled_at: new Date().toISOString(),
        cancelled_reason: args.reason || null,
        cancelled_by: 'nina_ai'
      }
    })
    .eq('id', appointment.id)
    .select()
    .single();

  if (error) {
    console.error('[Nina] Error canceling appointment:', error);
    return { error: error.message };
  }

  console.log('[Nina] Appointment cancelled successfully:', data.id);
  return data;
}
