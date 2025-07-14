import { supabase } from '@/integrations/supabase/client';

export const debugInvitationFlow = async (email: string) => {
  console.log('🔍 === DEBUGGING INVITATION FLOW FOR:', email, '===');
  
  try {
    // 1. Verificar usuario en auth.users
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Current authenticated user:', user?.email, user?.id);
    
    // 2. Verificar perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    console.log('📝 Profile:', profile, 'Error:', profileError);
    
    // 3. Verificar rol
    if (user?.id) {
      const { data: role, error: roleError } = await supabase
        .rpc('get_user_role', { _user_id: user.id });
      
      console.log('🎭 Role:', role, 'Error:', roleError);
    }
    
    // 4. Verificar invitaciones
    const { data: invitations, error: invError } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('📧 Recent invitations:', invitations, 'Error:', invError);
    
    // 5. Verificar cleaner si es rol cleaner
    const { data: cleaner, error: cleanerError } = await supabase
      .from('cleaners')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    console.log('🧹 Cleaner record:', cleaner, 'Error:', cleanerError);
    
    console.log('🔍 === END DEBUGGING ===');
    
  } catch (error) {
    console.error('❌ Error in debug flow:', error);
  }
};

export const testInvitationProcess = async (token: string, email: string) => {
  console.log('🧪 === TESTING INVITATION PROCESS ===');
  console.log('Token:', token);
  console.log('Email:', email);
  
  try {
    // 1. Test verify_invitation
    const { data: verifyResult, error: verifyError } = await supabase.rpc('verify_invitation', {
      token: token.trim(),
      email: email.trim(),
    });
    
    console.log('✅ Verify result:', verifyResult, 'Error:', verifyError);
    
    // 2. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 Current user for acceptance:', user?.email, user?.id);
    
    if (user && verifyResult) {
      // 3. Test accept_invitation
      const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_invitation', {
        invitation_token: token.trim(),
        input_user_id: user.id,
      });
      
      console.log('🎯 Accept result:', acceptResult, 'Error:', acceptError);
    }
    
    console.log('🧪 === END TESTING ===');
    
  } catch (error) {
    console.error('❌ Error in test process:', error);
  }
};