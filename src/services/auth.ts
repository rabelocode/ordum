import { supabase } from '../lib/supabase';

export const authService = {
  async signInWithEmailPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async resetPasswordForEmail(email: string, redirectTo?: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${window.location.origin}/#/auth/reset-password`,
    });
    if (error) throw error;
    return data;
  },

  async updatePassword(password: string, extraData?: { full_name?: string }) {
    const updateData: { password: string; data?: Record<string, any> } = { password };
    if (extraData?.full_name) {
      updateData.data = { full_name: extraData.full_name };
    }
    const { data, error } = await supabase.auth.updateUser(updateData);
    if (error) throw error;
    return data;
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }
};
