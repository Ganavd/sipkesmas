import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];
type AttachmentEntity = Database["public"]["Enums"]["attachment_entity"];

export const attachmentService = {
  async getLatestForEntity(entityType: AttachmentEntity, entityId: string): Promise<AttachmentRow | null> {
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upload(params: {
    file: File;
    entityType: AttachmentEntity;
    entityId: string;
    puskesmasId: string | null;
    uploadedBy: string;
  }): Promise<AttachmentRow> {
    const { file, entityType, entityId, puskesmasId, uploadedBy } = params;
    const path = `${entityType}/${entityId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);

    const { data: row, error } = await supabase
      .from("attachments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: pub.publicUrl,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: uploadedBy,
        puskesmas_id: puskesmasId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  },
};