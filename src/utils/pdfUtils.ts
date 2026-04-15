import { format } from "date-fns";
import { supabase } from "../lib/supabase";

export interface CompanySettings {
  company_name: string;
  company_logo: string;
  company_address: string;
  company_phone: string;
  company_website: string;
  resp_name: string;
  resp_role: string;
  resp_signature: string;
}

export const fetchSettings = async (): Promise<CompanySettings | null> => {
  try {
    const { data, error } = await supabase.from('company_settings').select('*').single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return data;
  } catch (error) {
    console.error("Failed to fetch settings", error);
    return null;
  }
};

export const addStandardHeaderToPDF = (doc: any, settings: CompanySettings | null, title: string, secondaryLogo?: string) => {
  let currentY = 20;

  if (settings) {
    // Logo
    if (settings.company_logo) {
      try {
        doc.addImage(settings.company_logo, "PNG", 14, 10, 30, 30, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add logo to PDF", e);
      }
    }

    if (secondaryLogo) {
      try {
        // Page width is typically 210mm for A4. 210 - 14 (margin) - 30 (width) = 166
        doc.addImage(secondaryLogo, "PNG", 166, 10, 30, 30, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add secondary logo to PDF", e);
      }
    }

    // Company Data (Centered next to logo)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(settings.company_name || "SST Gestão", 50, 18);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(settings.company_address || "", 50, 24);
    doc.text(`${settings.company_phone || ""} | ${settings.company_website || ""}`, 50, 30);
    
    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 50);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data de Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 56);
    
    currentY = 65;
  } else {
    // Fallback if no settings
    doc.setFontSize(18);
    doc.text(`SST Gestão - ${title}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    currentY = 40;
  }

  return currentY;
};

export const addStandardFooterToPDF = (doc: any, settings: CompanySettings | null, finalY: number, secondaryLogo?: string) => {
  let currentY = finalY + 20;
  
  // Ensure we don't go off page
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }

  if (settings) {
    doc.setDrawColor(200, 200, 200);
    doc.line(14, currentY, 196, currentY);
    
    currentY += 10;
    
    if (settings.resp_signature) {
      try {
        doc.addImage(settings.resp_signature, "PNG", 14, currentY, 50, 20, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add signature to PDF", e);
      }
    }

    if (secondaryLogo) {
      try {
        doc.addImage(secondaryLogo, "PNG", 166, currentY, 30, 30, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add secondary logo to footer", e);
      }
    }
    
    currentY += 25;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(settings.resp_name || "Responsável SST", 14, currentY);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(settings.resp_role || "Engenheiro/Técnico de Segurança", 14, currentY + 5);
  }

  return currentY;
};
