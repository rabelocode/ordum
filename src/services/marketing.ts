import { supabase } from '../lib/supabase';

export const marketingService = {
  async submitLead(data: {
    name: string;
    email: string;
    company: string;
    role_title?: string;
    phone?: string;
    interests: string[];
    message?: string;
    consent: boolean;
    source?: string;
    utm?: any;
  }) {
    const { data: result, error } = await (supabase as any).rpc('submit_marketing_lead', {
      p_name: data.name,
      p_email: data.email,
      p_company: data.company,
      p_role_title: data.role_title || null,
      p_phone: data.phone || null,
      p_interests: data.interests,
      p_message: data.message || null,
      p_consent: data.consent,
      p_source: data.source || null,
      p_utm: data.utm || null
    } as any);
    
    if (error) throw error;
    return result;
  }
};
