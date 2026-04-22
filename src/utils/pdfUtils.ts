import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 25;

  // 1. Black Top Bar (Premium Look)
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, 12, 'F');

  if (settings) {
    // Logo
    if (settings.company_logo) {
      try {
        doc.addImage(settings.company_logo, "PNG", 14, 15, 25, 25, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add logo to PDF", e);
      }
    }

    if (secondaryLogo) {
      try {
        doc.addImage(secondaryLogo, "PNG", pageWidth - 39, 15, 25, 25, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add secondary logo to PDF", e);
      }
    }

    // Company Data
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(settings.company_name || "SST Gestão", 45, 22);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(settings.company_address || "", 45, 28);
    doc.text(`${settings.company_phone || ""} | ${settings.company_website || ""}`, 45, 33);
    
    // Horizontal Line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 45, pageWidth - 14, 45);

    // Title - RED and BOLD
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(190, 0, 0); // Solid Red
    doc.text(title.toUpperCase(), 14, 55);
    
    // Emission Date
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Data de Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 61);
    
    // Reset colors for next elements
    doc.setTextColor(0, 0, 0);
    currentY = 75;
  } else {
    // Fallback if no settings
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(190, 0, 0);
    doc.text(title.toUpperCase(), 14, 25);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Data de Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 31);
    
    doc.setTextColor(0, 0, 0);
    currentY = 45;
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

export const addPPEReceiptPageToPDF = (doc: jsPDF, settings: CompanySettings | null, emp: any, items: any[], date: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // 1. Header Grid Box
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(margin, 10, contentWidth, 30); 
  
  doc.line(margin + 40, 10, margin + 40, 40); // After Logo
  doc.line(margin + 150, 10, margin + 150, 40); // Before "Código"

  // Logo
  if (settings?.company_logo) {
    try {
      doc.addImage(settings.company_logo, "PNG", margin + 5, 12, 30, 26, undefined, 'FAST');
    } catch (e) {
      console.warn("Could not add logo", e);
    }
  }

  // Company and Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(settings?.company_name || "SST GESTÃO", margin + 95, 18, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text("Controle de Equipamentos de", margin + 95, 26, { align: 'center' });
  doc.text("Proteção Individual (EPIs)", margin + 95, 32, { align: 'center' });

  // Código box
  doc.setFontSize(8);
  doc.text("Código", margin + 152, 15);

  // 2. Employee Info Grid
  doc.rect(margin, 40, contentWidth, 30);
  doc.line(margin, 50, margin + contentWidth, 50); // Row 1-2 divider
  doc.line(margin, 60, margin + contentWidth, 60); // Row 2-3 divider
  
  doc.line(margin + 100, 50, margin + 100, 60); // Setor | Função divider

  doc.setFontSize(9);
  
  // Row 1: Nome
  doc.setFont("helvetica", "bold");
  doc.text("Nome:", margin + 2, 46);
  doc.setFont("helvetica", "normal");
  doc.text(emp.name || "-", margin + 15, 46);

  // Row 2: Setor | Função
  doc.setFont("helvetica", "bold");
  doc.text("Setor:", margin + 2, 56);
  doc.setFont("helvetica", "normal");
  doc.text(emp.sector || "-", margin + 15, 56);
  
  doc.setFont("helvetica", "bold");
  doc.text("Função:", margin + 102, 56);
  doc.setFont("helvetica", "normal");
  doc.text(emp.role || "-", margin + 120, 56);

  // Row 3: Datas
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("ADMISSÃO:", margin + 2, 66);
  doc.setFont("helvetica", "normal");
  doc.text(emp.admission_date ? format(new Date(emp.admission_date), 'dd/MM/yyyy') : "-", margin + 22, 66);

  doc.setFont("helvetica", "bold");
  doc.text("DEMISSÃO:", margin + 55, 66);
  doc.setFont("helvetica", "normal");
  doc.text(emp.termination_date ? format(new Date(emp.termination_date), 'dd/MM/yyyy') : "-", margin + 75, 66);

  doc.setFont("helvetica", "bold");
  doc.text("Responsável legal (quando menor):", margin + 102, 66);

  // 3. Declaration Text
  const companyName = settings?.company_name || "EMPRESA";
  const declText = `RECEBI da ${companyName} os EPIs abaixo relacionados, para serem usados no desempenho de minhas funções. DECLARO que estou ciente de que o uso desses EPIs é obrigatório, e que a não uso implicará insubordinação e aplicação das penalidades disciplinares previstas em lei. DECLARO que estou ciente de minhas responsabilidades e me comprometo a usar adequadamente e a zelar pela conservação dos EPIs recebidos, bem como a indenizar à ${companyName} o valor correspondente ao EPI recebido em caso comprovados danos dentro de prazo de validade, perda ou extravio do EPI. DECLARO que recebi o treinamento e orientações corretas referente ao uso e conservação do E.P.I segundo as Normas de Segurança do Trabalho e comprometo-me a segui-los. Fiz a leitura do presente documento quando o recebi, e minha assinatura e rubrica, apostas no local indicado no cartão, confirmam a minha concordância com os termos acima.`;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Recibo de Equipamento de Proteção Individual (EPI)", margin + contentWidth / 2, 78, { align: 'center' });
  
  doc.setFont("helvetica", "normal");
  const splitDecl = doc.splitTextToSize(declText, contentWidth - 4);
  doc.text(splitDecl, margin + 2, 84, { align: 'justify' });

  // 4. Items Table
  const tableRows = items.map((item, index) => [
    item.name || '-',
    (index + 1).toString(),
    item.quantity.toString(),
    format(new Date(date), "dd/MM/yyyy"),
    "", // Devolução
    "", // Rubrica
    item.ca || '-',
    item.validity_date ? format(new Date(item.validity_date), "dd/MM/yyyy") : '-'
  ]);

  // Fill empty rows
  while (tableRows.length < 15) {
    tableRows.push(["", (tableRows.length + 1).toString(), "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: 110,
    head: [["EQUIPAMENTO", "N.º", "QTD", "Recebi", "Devolução", "Rubrica", "C.A.", "Validade"]],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [240, 240, 240], 
      textColor: [0, 0, 0], 
      fontSize: 7, 
      halign: 'center',
      cellPadding: 1,
      lineWidth: 0.1
    },
    styles: { 
      fontSize: 7, 
      textColor: [0, 0, 0],
      cellPadding: 1,
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 50 }, // Equipamento
      1: { cellWidth: 10 }, // N.º
      2: { cellWidth: 10 }, // QTD
      3: { cellWidth: 18 }, // Recebi
      4: { cellWidth: 18 }, // Devolução
      5: { cellWidth: 20 }, // Rubrica
      6: { cellWidth: 18 }, // C.A.
      7: { cellWidth: 18 }  // Validade
    },
    margin: { left: margin, right: margin }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 15;
  
  if (finalY > 270) {
    doc.addPage();
    finalY = 20;
  }

  // 5. Signature
  doc.setFontSize(9);
  doc.setLineWidth(0.5);
  
  doc.line(margin + 35, finalY + 10, margin + 180, finalY + 10);
  doc.text(`Assinatura colaborador:`, margin, finalY + 9);

  const respY = finalY + 30;
  if (settings?.resp_signature) {
    try {
      doc.addImage(settings.resp_signature, 'PNG', margin + 80, respY - 15, 30, 12);
    } catch (e) {
       console.warn("Signature error", e);
    }
  }
  doc.line(margin + 60, respY, margin + 140, respY);
  doc.setFont("helvetica", "bold");
  doc.text(settings?.resp_name || "Responsável SST", margin + 100, respY + 5, { align: 'center' });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(settings?.resp_role || "Representante da Empresa", margin + 100, respY + 10, { align: 'center' });
};

export const generatePPEReceiptPDF = (settings: CompanySettings | null, emp: any, items: any[], date: string) => {
  const doc = new jsPDF();
  addPPEReceiptPageToPDF(doc, settings, emp, items, date);
  return doc;
};
