
-- ============================================================
-- TRIGGER 1: auto_create_deal_on_contact
-- Cria automaticamente um deal quando um novo contato é inserido
-- ============================================================

-- Primeiro, verificar se existe o estágio padrão para novo deal
CREATE OR REPLACE FUNCTION public.auto_create_deal_on_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_stage_id UUID;
BEGIN
    -- Buscar o primeiro estágio ativo do pipeline (menor posição)
    SELECT id INTO default_stage_id
    FROM pipeline_stages
    WHERE is_active = true
    ORDER BY position ASC
    LIMIT 1;

    -- Se não houver estágio, não cria deal
    IF default_stage_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Criar o deal associado ao contato
    INSERT INTO public.deals (
        contact_id,
        title,
        stage_id,
        user_id,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.name, 'Novo Lead') || ' - Deal',
        default_stage_id,
        NEW.user_id,
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$;

-- Dropar trigger existente se houver
DROP TRIGGER IF EXISTS auto_create_deal_on_contact_trigger ON public.contacts;

-- Criar trigger
CREATE TRIGGER auto_create_deal_on_contact_trigger
    AFTER INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_deal_on_contact();


-- ============================================================
-- TRIGGER 2: update_conversation_last_message
-- Atualiza last_message_at da conversa e last_activity do contato
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    contact_id_var UUID;
BEGIN
    -- Atualizar a conversa com o último timestamp de mensagem
    UPDATE public.conversations
    SET last_message_at = NEW.sent_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Obter o contact_id da conversa para atualizar o contato
    SELECT c.contact_id INTO contact_id_var
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;

    -- Atualizar last_activity do contato
    IF contact_id_var IS NOT NULL THEN
        UPDATE public.contacts
        SET last_activity = NEW.sent_at,
            updated_at = NOW()
        WHERE id = contact_id_var;
    END IF;

    RETURN NEW;
END;
$$;

-- Dropar trigger existente se houver
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON public.messages;

-- Criar trigger
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_last_message();


-- ============================================================
-- TRIGGER 3: updated_at triggers para tabelas relevantes
-- ============================================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- contacts
DROP TRIGGER IF EXISTS contacts_updated_at_trigger ON public.contacts;
CREATE TRIGGER contacts_updated_at_trigger
    BEFORE UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- conversations
DROP TRIGGER IF EXISTS conversations_updated_at_trigger ON public.conversations;
CREATE TRIGGER conversations_updated_at_trigger
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- conversation_states
DROP TRIGGER IF EXISTS conversation_states_updated_at_trigger ON public.conversation_states;
CREATE TRIGGER conversation_states_updated_at_trigger
    BEFORE UPDATE ON public.conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- nina_processing_queue
DROP TRIGGER IF EXISTS nina_processing_queue_updated_at_trigger ON public.nina_processing_queue;
CREATE TRIGGER nina_processing_queue_updated_at_trigger
    BEFORE UPDATE ON public.nina_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- message_processing_queue
DROP TRIGGER IF EXISTS message_processing_queue_updated_at_trigger ON public.message_processing_queue;
CREATE TRIGGER message_processing_queue_updated_at_trigger
    BEFORE UPDATE ON public.message_processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- send_queue
DROP TRIGGER IF EXISTS send_queue_updated_at_trigger ON public.send_queue;
CREATE TRIGGER send_queue_updated_at_trigger
    BEFORE UPDATE ON public.send_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- nina_settings
DROP TRIGGER IF EXISTS nina_settings_updated_at_trigger ON public.nina_settings;
CREATE TRIGGER nina_settings_updated_at_trigger
    BEFORE UPDATE ON public.nina_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- tag_definitions
DROP TRIGGER IF EXISTS tag_definitions_updated_at_trigger ON public.tag_definitions;
CREATE TRIGGER tag_definitions_updated_at_trigger
    BEFORE UPDATE ON public.tag_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
