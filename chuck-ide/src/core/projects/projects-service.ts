import { supabase, authService } from '../auth/auth-service.js';

export interface Project {
  id: string;
  name: string;
  code: string;
  updatedAt: string;
}

class ProjectsService {
  async list(): Promise<Project[]> {
    const user = authService.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, code, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return data.map((r) => ({ id: r.id, name: r.name, code: r.code, updatedAt: r.updated_at }));
  }

  async create(name: string, code = ''): Promise<Project | null> {
    const user = authService.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name, code })
      .select()
      .single();
    if (error || !data) return null;
    return { id: data.id, name: data.name, code: data.code, updatedAt: data.updated_at };
  }

  async save(id: string, code: string): Promise<void> {
    const user = authService.getUser();
    if (!user) return;
    await supabase
      .from('projects')
      .update({ code, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  async rename(id: string, name: string): Promise<void> {
    const user = authService.getUser();
    if (!user) return;
    await supabase.from('projects').update({ name }).eq('id', id).eq('user_id', user.id);
  }

  async remove(id: string): Promise<void> {
    const user = authService.getUser();
    if (!user) return;
    await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id);
  }
}

export const projectsService = new ProjectsService();