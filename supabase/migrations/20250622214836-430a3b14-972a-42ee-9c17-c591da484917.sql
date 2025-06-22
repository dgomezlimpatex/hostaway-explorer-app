
-- Crear enum para estado de invitaciones
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- Tabla de invitaciones
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    role app_role NOT NULL,
    invited_by UUID REFERENCES auth.users(id) NOT NULL,
    invitation_token UUID DEFAULT gen_random_uuid() UNIQUE,
    status invitation_status DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Habilitar RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Políticas para invitaciones
CREATE POLICY "Admin y managers pueden ver todas las invitaciones" 
    ON public.user_invitations FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admin y managers pueden crear invitaciones" 
    ON public.user_invitations FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admin y managers pueden actualizar invitaciones" 
    ON public.user_invitations FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'manager')
        )
    );

-- Función para verificar invitación válida
CREATE OR REPLACE FUNCTION public.verify_invitation(token UUID, email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE invitation_token = token
        AND email = $2
        AND status = 'pending'
        AND expires_at > now()
    )
$$;

-- Función para aceptar invitación
CREATE OR REPLACE FUNCTION public.accept_invitation(token UUID, user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invitation_role app_role;
    invitation_email TEXT;
BEGIN
    -- Obtener datos de la invitación
    SELECT role, email INTO invitation_role, invitation_email
    FROM public.user_invitations
    WHERE invitation_token = token
    AND status = 'pending'
    AND expires_at > now();
    
    IF invitation_role IS NULL THEN
        RAISE EXCEPTION 'Invitación inválida o expirada';
    END IF;
    
    -- Verificar que el email del usuario coincida
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = user_id AND email = invitation_email
    ) THEN
        RAISE EXCEPTION 'El email no coincide con la invitación';
    END IF;
    
    -- Marcar invitación como aceptada
    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE invitation_token = token;
    
    -- Asignar rol al usuario
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id, invitation_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN invitation_role;
END;
$$;

-- Modificar la función handle_new_user para NO asignar roles automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  
  -- Ya NO asignamos roles automáticamente
  -- Los roles se asignan solo a través del sistema de invitaciones
  
  RETURN new;
END;
$$;

-- Trigger para limpiar invitaciones expiradas automáticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
    UPDATE public.user_invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();
$$;
