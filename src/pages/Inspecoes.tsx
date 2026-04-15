import React, { useState, useEffect, useRef } from "react";
import { ClipboardCheck, Plus, X, Save, Camera, AlertCircle, PenTool, Trash2 } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { format } from "date-fns";
import { clsx } from "clsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { SectorBadge } from "../utils/sectorColors";
import { ImageUpload } from "../components/ImageUpload";
import { useDatabaseOptions } from "../hooks/useDatabaseOptions";
import { SelectWithNew } from "../components/SelectWithNew";
import { supabase } from "../lib/supabase";

type InspectionType = "NR-10" | "NR-12" | "NR-24" | "NR-35" | "NR-6" | "5S" | "Incêndio" | "Empilhadeira Combustão" | "Empilhadeira Elétrica" | "Esmerilhadeira" | "Solda MIG" | "Solda Elétrica" | "Mecânicos" | "Fornecedores/Terceirizados" | null;

export default function Inspecoes() {
  const { sectors } = useDatabaseOptions();
  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [inspectionType, setInspectionType] = useState<InspectionType>(null);
  
  const [nr10Data, setNr10Data] = useState<any[]>([]);
  const [nr12Data, setNr12Data] = useState<any[]>([]);
  const [nr24Data, setNr24Data] = useState<any[]>([]);
  const [nr35Data, setNr35Data] = useState<any[]>([]);
  const [nr6Data, setNr6Data] = useState<any[]>([]);
  const [data5s, setData5s] = useState<any[]>([]);
  const [fireData, setFireData] = useState<any[]>([]);
  const [empCombustaoData, setEmpCombustaoData] = useState<any[]>([]);
  const [empEletricaData, setEmpEletricaData] = useState<any[]>([]);
  const [esmerilhadeiraData, setEsmerilhadeiraData] = useState<any[]>([]);
  const [soldaMigData, setSoldaMigData] = useState<any[]>([]);
  const [soldaEletricaData, setSoldaEletricaData] = useState<any[]>([]);
  const [mecanicosData, setMecanicosData] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [availablePpes, setAvailablePpes] = useState<any[]>([]);

  const [formData, setFormData] = useState<any>({});
  const [ppesList, setPpesList] = useState<any[]>([{ name: "", condition: "", ca: "", proper_usage: "", photo_url: "" }]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  
  const techSigRef = useRef<SignatureCanvas>(null);
  const inspectedSigRef = useRef<SignatureCanvas>(null);

  const loadData = async () => {
    try {
      const [
        nr10, nr12, nr24, nr35, nr6, s5, fire,
        empCombustao, empEletrica, esmerilhadeira, soldaMig, soldaEletrica, mecanicos,
        equip, ppesList, settingsRes
      ] = await Promise.all([
        supabase.from('inspection_nr10').select('*').order('date', { ascending: false }),
        supabase.from('inspection_nr12').select('*').order('date', { ascending: false }),
        supabase.from('inspection_nr24').select('*').order('date', { ascending: false }),
        supabase.from('inspection_nr35').select('*').order('date', { ascending: false }),
        supabase.from('inspection_nr6').select('*').order('date', { ascending: false }),
        supabase.from('inspection_5s').select('*').order('date', { ascending: false }),
        supabase.from('inspection_fire').select('*').order('date', { ascending: false }),
        supabase.from('inspection_empilhadeira_combustao').select('*').order('date', { ascending: false }),
        supabase.from('inspection_empilhadeira_eletrica').select('*').order('date', { ascending: false }),
        supabase.from('inspection_esmerilhadeira').select('*').order('date', { ascending: false }),
        supabase.from('inspection_solda_mig').select('*').order('date', { ascending: false }),
        supabase.from('inspection_solda_eletrica').select('*').order('date', { ascending: false }),
        supabase.from('inspection_mecanicos').select('*').order('date', { ascending: false }),
        supabase.from('fire_equipment').select('*'),
        supabase.from('ppes').select('*'),
        fetchSettings()
      ]);

      if (nr10.data) setNr10Data(nr10.data);
      if (nr12.data) setNr12Data(nr12.data);
      if (nr24.data) setNr24Data(nr24.data);
      if (nr35.data) setNr35Data(nr35.data);
      if (nr6.data) setNr6Data(nr6.data);
      if (s5.data) setData5s(s5.data);
      if (fire.data) setFireData(fire.data);
      if (empCombustao.data) setEmpCombustaoData(empCombustao.data);
      if (empEletrica.data) setEmpEletricaData(empEletrica.data);
      if (esmerilhadeira.data) setEsmerilhadeiraData(esmerilhadeira.data);
      if (soldaMig.data) setSoldaMigData(soldaMig.data);
      if (soldaEletrica.data) setSoldaEletricaData(soldaEletrica.data);
      if (mecanicos.data) setMecanicosData(mecanicos.data);
      if (equip.data) setEquipment(equip.data);
      if (ppesList.data) setAvailablePpes(ppesList.data);
      
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading inspections data:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [e.target.name]: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelect = (file: File, name?: string) => {
    if (file && name) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [name]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionType) return;

    const endpoint = 
      inspectionType === "NR-10" ? "inspection_nr10" :
      inspectionType === "NR-12" ? "inspection_nr12" :
      inspectionType === "NR-35" ? "inspection_nr35" :
      inspectionType === "NR-6" ? "inspection_nr6" :
      inspectionType === "5S" ? "inspection_5s" :
      inspectionType === "Incêndio" ? "inspection_fire" :
      inspectionType === "Empilhadeira Combustão" ? "inspection_empilhadeira_combustao" :
      inspectionType === "Empilhadeira Elétrica" ? "inspection_empilhadeira_eletrica" :
      inspectionType === "Esmerilhadeira" ? "inspection_esmerilhadeira" :
      inspectionType === "Solda MIG" ? "inspection_solda_mig" :
      inspectionType === "Solda Elétrica" ? "inspection_solda_eletrica" :
      inspectionType === "Mecânicos" ? "inspection_mecanicos" :
      inspectionType === "Fornecedores/Terceirizados" ? "inspection_terceiros" :
      "inspection_nr24";

    let bodyData = { 
      ...formData, 
      date: new Date().toISOString(),
      tech_signature: techSigRef.current?.isEmpty() ? null : techSigRef.current?.getTrimmedCanvas().toDataURL('image/png'),
      inspected_signature: inspectedSigRef.current?.isEmpty() ? null : inspectedSigRef.current?.getTrimmedCanvas().toDataURL('image/png')
    };

    if (inspectionType === "5S") {
      // Calculate total score
      let total = 0;
      for (let i = 1; i <= 12; i++) {
        const score = parseInt(formData[`item${i}`] || "0", 10);
        if (score > 0) {
          // 5 = 100%, 4 = 80%, 3 = 60%, 2 = 40%, 1 = 20%
          const percentage = score * 20; // 5 -> 100, 4 -> 80, etc.
          // Each item is worth max 8.3333 points (100 / 12)
          const itemPoints = (percentage / 100) * (100 / 12);
          total += itemPoints;
        }
      }
      bodyData.total_score = total;
    }

    if (inspectionType === "NR-6") {
      bodyData.ppes_list = JSON.stringify(ppesList);
      
      try {
        // Generate PDF
        const doc = new jsPDF();
        
        let currentY = addStandardHeaderToPDF(doc, settings, "Inspeção de EPI (NR-6)");
        
        doc.setFontSize(12);
        doc.text(`Data: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, currentY);
        doc.text(`Inspetor: ${formData.inspector || ""}`, 14, currentY + 8);
        doc.text(`Setor: ${formData.sector || ""}`, 14, currentY + 16);
        doc.text(`Colaborador: ${formData.employee_name || ""}`, 14, currentY + 24);
        
        const tableColumn = ["EPI", "CA", "Condição", "Uso Adequado"];
        const tableRows = ppesList.map(ppe => [ppe.name, ppe.ca, ppe.condition, ppe.proper_usage]);
        
        autoTable(doc, {
          startY: currentY + 35,
          head: [tableColumn],
          body: tableRows,
        });

        let finalY = (doc as any).lastAutoTable.finalY || currentY + 35;

        doc.text("Observações:", 14, finalY + 10);
        doc.setFontSize(10);
        doc.text(formData.observations || "Nenhuma observação.", 14, finalY + 18, { maxWidth: 180 });
        
        finalY += 30;

        if (bodyData.tech_signature) {
          doc.addImage(bodyData.tech_signature, "PNG", 14, finalY, 50, 20);
          doc.text(formData.tech_name || "Técnico", 14, finalY + 25);
          doc.text(formData.tech_role || "Técnico de Segurança", 14, finalY + 30);
        }

        if (bodyData.inspected_signature) {
          doc.addImage(bodyData.inspected_signature, "PNG", 100, finalY, 50, 20);
          doc.text(formData.inspected_name || "Inspecionado", 100, finalY + 25);
          doc.text(formData.inspected_role || "Colaborador", 100, finalY + 30);
        }

        finalY += 40;
        addStandardFooterToPDF(doc, settings, finalY);

        const pdfBase64 = doc.output('datauristring');
        
        // Send email (Note: since we are entirely frontend now, this might need a 3rd party service or edge function)
        // For now, we will just log it or handle it if there's an edge function.
        console.log("PDF generated, email sending is disabled in frontend-only mode.");
      } catch (err) {
        console.error("Error generating PDF:", err);
      }
    }

    if (inspectionType === "Fornecedores/Terceirizados") {
      try {
        const doc = new jsPDF();
        let currentY = addStandardHeaderToPDF(doc, settings, "Inspeção de Fornecedores/Terceirizados");
        
        doc.setFontSize(12);
        doc.text(`Data: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, currentY);
        doc.text(`Inspetor: ${formData.inspector || ""}`, 14, currentY + 8);
        doc.text(`Empresa: ${formData.company_name || ""}`, 14, currentY + 16);
        doc.text(`Trabalhador: ${formData.worker_name || ""} (${formData.worker_type || ""})`, 14, currentY + 24);
        
        const tableColumn = ["Item", "Resposta"];
        const tableRows = [
          ["Recebeu instruções de uso de EPI nas dependências?", formData.received_epi_instructions || ""],
          ["Recebeu treinamento?", formData.received_training || ""],
          ["Participou da integração?", formData.participated_integration || ""],
          ["Tem os EPIs necessários para executar as atividades?", formData.has_necessary_epis || ""],
          ["Precisa preencher Permissão de Trabalho (PT)?", formData.needs_work_permit || ""],
        ];
        
        autoTable(doc, {
          startY: currentY + 35,
          head: [tableColumn],
          body: tableRows,
        });

        let finalY = (doc as any).lastAutoTable.finalY || currentY + 35;

        doc.text("Descrição da Atividade:", 14, finalY + 10);
        doc.setFontSize(10);
        doc.text(formData.activity_description || "", 14, finalY + 18, { maxWidth: 180 });

        finalY += 30;
        doc.setFontSize(12);
        doc.text(`Acompanhante: ${formData.accompanier_name || ""} (${formData.accompanier_role || ""})`, 14, finalY);

        finalY += 15;
        doc.text("Observações:", 14, finalY);
        doc.setFontSize(10);
        doc.text(formData.observations || "Nenhuma observação.", 14, finalY + 8, { maxWidth: 180 });
        
        finalY += 30;

        if (bodyData.tech_signature) {
          doc.addImage(bodyData.tech_signature, "PNG", 14, finalY, 50, 20);
          doc.text(formData.tech_name || "Técnico", 14, finalY + 25);
          doc.text(formData.tech_role || "Técnico de Segurança", 14, finalY + 30);
        }

        if (bodyData.inspected_signature) {
          doc.addImage(bodyData.inspected_signature, "PNG", 100, finalY, 50, 20);
          doc.text(formData.inspected_name || "Inspecionado", 100, finalY + 25);
          doc.text(formData.inspected_role || "Colaborador", 100, finalY + 30);
        }

        finalY += 40;
        addStandardFooterToPDF(doc, settings, finalY);

        const pdfBase64 = doc.output('datauristring');
        console.log("PDF generated for Fornecedores/Terceirizados.");
      } catch (err) {
        console.error("Error generating PDF:", err);
      }
    }

    try {
      const { error } = await supabase.from(endpoint).insert([bodyData]);
      if (error) throw error;

      setFormData({});
      setInspectionType(null);
      setActiveTab("list");
      loadData();
    } catch (error) {
      console.error("Error saving inspection:", error);
      alert("Erro ao salvar inspeção.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <ClipboardCheck className="w-8 h-8 text-emerald-600" />
          Inspeções de Segurança
        </h1>
        {activeTab === "list" ? (
          <button 
            onClick={() => setActiveTab("new")}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Nova Inspeção</span>
          </button>
        ) : (
          <button 
            onClick={() => { setActiveTab("list"); setInspectionType(null); }}
            className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            <X className="w-5 h-5" />
            <span>Cancelar</span>
          </button>
        )}
      </div>

      {activeTab === "new" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Realizar Nova Inspeção</h2>
          
          {!inspectionType ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button onClick={() => setInspectionType("NR-10")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-left">
                <h3 className="text-lg font-bold text-emerald-700 mb-2">NR-10 (Elétrica)</h3>
                <p className="text-sm text-gray-600">Inspeção de painéis, aterramento e sinalização.</p>
              </button>
              <button onClick={() => setInspectionType("NR-12")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition text-left">
                <h3 className="text-lg font-bold text-orange-700 mb-2">NR-12 (Máquinas)</h3>
                <p className="text-sm text-gray-600">Inspeção de proteções e botões de emergência.</p>
              </button>
              <button onClick={() => setInspectionType("NR-24")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-left">
                <h3 className="text-lg font-bold text-emerald-700 mb-2">NR-24 (Sanitários)</h3>
                <p className="text-sm text-gray-600">Inspeção de condições sanitárias e vestiários.</p>
              </button>
              <button onClick={() => setInspectionType("NR-35")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition text-left">
                <h3 className="text-lg font-bold text-purple-700 mb-2">NR-35 (Altura)</h3>
                <p className="text-sm text-gray-600">Inspeção de ancoragem, linhas de vida e cinturões.</p>
              </button>
              <button onClick={() => setInspectionType("NR-6")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition text-left">
                <h3 className="text-lg font-bold text-teal-700 mb-2">NR-6 (EPIs)</h3>
                <p className="text-sm text-gray-600">Inspeção de conservação, CA e uso adequado.</p>
              </button>
              <button onClick={() => setInspectionType("5S")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-left">
                <h3 className="text-lg font-bold text-emerald-700 mb-2">Programa 5S</h3>
                <p className="text-sm text-gray-600">Limpeza, organização e conservação do setor.</p>
              </button>
              <button onClick={() => setInspectionType("Incêndio")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-red-500 hover:bg-red-50 transition text-left">
                <h3 className="text-lg font-bold text-red-700 mb-2">Prevenção de Incêndio</h3>
                <p className="text-sm text-gray-600">Inspeção de hidrantes, extintores, alarmes e botoeiras (NR-23/CBMRS).</p>
              </button>
              <button onClick={() => setInspectionType("Empilhadeira Combustão")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition text-left">
                <h3 className="text-lg font-bold text-yellow-700 mb-2">Empilhadeira a Combustão</h3>
                <p className="text-sm text-gray-600">Checklist diário de segurança e funcionamento.</p>
              </button>
              <button onClick={() => setInspectionType("Empilhadeira Elétrica")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition text-left">
                <h3 className="text-lg font-bold text-yellow-700 mb-2">Empilhadeira Elétrica</h3>
                <p className="text-sm text-gray-600">Checklist diário de segurança, bateria e funcionamento.</p>
              </button>
              <button onClick={() => setInspectionType("Esmerilhadeira")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-500 hover:bg-gray-50 transition text-left">
                <h3 className="text-lg font-bold text-gray-700 mb-2">Esmerilhadeira</h3>
                <p className="text-sm text-gray-600">Inspeção de cabos, discos, proteções e plugues.</p>
              </button>
              <button onClick={() => setInspectionType("Solda MIG")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-left">
                <h3 className="text-lg font-bold text-emerald-700 mb-2">Solda MIG</h3>
                <p className="text-sm text-gray-600">Inspeção de cilindros, tochas, reguladores e cabos.</p>
              </button>
              <button onClick={() => setInspectionType("Solda Elétrica")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition text-left">
                <h3 className="text-lg font-bold text-emerald-700 mb-2">Solda Elétrica</h3>
                <p className="text-sm text-gray-600">Inspeção de cabos, porta-eletrodos e garras negativas.</p>
              </button>
              <button onClick={() => setInspectionType("Mecânicos")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-slate-500 hover:bg-slate-50 transition text-left">
                <h3 className="text-lg font-bold text-slate-700 mb-2">Funções Mecânicas</h3>
                <p className="text-sm text-gray-600">Inspeção de ferramentas manuais, pneumáticas e talhas.</p>
              </button>
              <button onClick={() => setInspectionType("Fornecedores/Terceirizados")} className="p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-cyan-500 hover:bg-cyan-50 transition text-left">
                <h3 className="text-lg font-bold text-cyan-700 mb-2">Fornecedores e Terceirizados</h3>
                <p className="text-sm text-gray-600">Inspeção de EPIs, treinamentos, integração e PT.</p>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 flex justify-between items-center">
                <span className="font-bold text-gray-700">Tipo Selecionado: {inspectionType}</span>
                <button type="button" onClick={() => setInspectionType(null)} className="text-sm text-emerald-600 hover:underline">Trocar Tipo</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inspetor</label>
                  <input required type="text" name="inspector" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                
                {(inspectionType === "NR-10" || inspectionType === "NR-6" || inspectionType === "5S" || inspectionType === "Incêndio" || inspectionType === "Empilhadeira Combustão" || inspectionType === "Empilhadeira Elétrica" || inspectionType === "Esmerilhadeira" || inspectionType === "Solda MIG" || inspectionType === "Solda Elétrica" || inspectionType === "Mecânicos") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Setor / Área</label>
                    <SelectWithNew
                      name="sector"
                      value={formData.sector || ""}
                      onChange={handleInputChange}
                      options={sectors}
                      placeholder="Selecione um setor"
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    />
                  </div>
                )}
                
                {inspectionType === "5S" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Líder do Setor</label>
                    <input required type="text" name="leader" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                )}

                {inspectionType === "NR-12" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome/TAG da Máquina</label>
                    <input required type="text" name="machine_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                )}

                {(inspectionType === "NR-24" || inspectionType === "NR-35") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
                    <input required type="text" name="location" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                )}
              </div>

              {/* Photo Uploads (Camera) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-4 mt-4 bg-gray-50 p-4 rounded-lg">
                <ImageUpload
                  label={<><Camera className="w-4 h-4 text-emerald-600"/> Foto do Local/Máquina/Equipamento</>}
                  name="photo_location"
                  currentImage={formData.photo_location}
                  onImageSelect={handleImageSelect}
                />
                <ImageUpload
                  label={<><AlertCircle className="w-4 h-4 text-red-500"/> Foto da Não Conformidade</>}
                  name="photo_nonconformity"
                  currentImage={formData.photo_nonconformity}
                  onImageSelect={handleImageSelect}
                />
                {inspectionType === "Incêndio" && (
                  <>
                    <ImageUpload
                      label={<><Camera className="w-4 h-4 text-gray-500"/> Foto Adicional 1 (Opcional)</>}
                      name="photo_extra_1"
                      currentImage={formData.photo_extra_1}
                      onImageSelect={handleImageSelect}
                    />
                    <ImageUpload
                      label={<><Camera className="w-4 h-4 text-gray-500"/> Foto Adicional 2 (Opcional)</>}
                      name="photo_extra_2"
                      currentImage={formData.photo_extra_2}
                      onImageSelect={handleImageSelect}
                    />
                  </>
                )}
              </div>

              {/* NR-10 Specific Fields */}
              {inspectionType === "NR-10" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condição do Painel Elétrico</label>
                    <select required name="panel_condition" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aterramento</label>
                    <select required name="grounding" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sinalização de Risco</label>
                    <select required name="signaling" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>
              )}

              {/* NR-12 Specific Fields */}
              {inspectionType === "NR-12" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Botão de Emergência</label>
                    <select required name="emergency_button" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proteções Físicas (Grades/Carenagens)</label>
                    <select required name="safety_guards" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sistema de Intertravamento</label>
                    <select required name="interlock_system" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>
              )}

              {/* NR-24 Specific Fields */}
              {inspectionType === "NR-24" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Limpeza e Higienização</label>
                    <select required name="cleanliness" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condição dos Armários</label>
                    <select required name="lockers_condition" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condição dos Chuveiros/Pias</label>
                    <select required name="showers_condition" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>
              )}

              {/* NR-35 Specific Fields */}
              {inspectionType === "NR-35" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pontos de Ancoragem</label>
                    <select required name="anchor_points" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Linhas de Vida</label>
                    <select required name="lifelines" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cinturões e Talabartes</label>
                    <select required name="harnesses" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>
              )}

              {/* NR-6 Specific Fields */}
              {inspectionType === "NR-6" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Colaborador Inspecionado</label>
                    <input required type="text" name="employee_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-4">EPIs Inspecionados</h4>
                    {ppesList.map((ppe, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4 items-end bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="sm:col-span-1 flex justify-center items-center h-full">
                          {ppe.photo_url ? (
                            <img src={ppe.photo_url} alt={ppe.name} className="w-10 h-10 object-cover rounded border border-gray-300" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-500">Sem Foto</div>
                          )}
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">EPI</label>
                          <select 
                            required 
                            value={ppe.name} 
                            onChange={(e) => { 
                              const selectedPpe = availablePpes.find(p => p.name === e.target.value);
                              const newPpes = [...ppesList]; 
                              newPpes[index].name = e.target.value; 
                              if (selectedPpe) {
                                newPpes[index].ca = selectedPpe.ca;
                                newPpes[index].photo_url = selectedPpe.photo_url;
                              } else {
                                newPpes[index].ca = "";
                                newPpes[index].photo_url = "";
                              }
                              setPpesList(newPpes); 
                            }} 
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400"
                          >
                            <option value="">Selecione...</option>
                            {availablePpes.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                            {/* Allow custom input if needed by keeping the option to type? No, select is better */}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">CA</label>
                          <input required type="text" value={ppe.ca} onChange={(e) => { const newPpes = [...ppesList]; newPpes[index].ca = e.target.value; setPpesList(newPpes); }} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" placeholder="Nº do CA" />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Condição</label>
                          <select required value={ppe.condition} onChange={(e) => { const newPpes = [...ppesList]; newPpes[index].condition = e.target.value; setPpesList(newPpes); }} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400">
                            <option value="">Selecione...</option>
                            <option value="Bom">Bom</option>
                            <option value="Ruim">Ruim</option>
                            <option value="Faltando">Faltando</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Uso Adequado</label>
                          <select required value={ppe.proper_usage} onChange={(e) => { const newPpes = [...ppesList]; newPpes[index].proper_usage = e.target.value; setPpesList(newPpes); }} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400">
                            <option value="">Selecione...</option>
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                          </select>
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button type="button" onClick={() => { const newPpes = [...ppesList]; newPpes.splice(index, 1); setPpesList(newPpes); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Remover EPI">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setPpesList([...ppesList, { name: "", condition: "", ca: "", proper_usage: "", photo_url: "" }])} className="flex items-center gap-2 text-sm text-emerald-600 hover:text-blue-800 font-medium">
                      <Plus className="w-4 h-4" /> Adicionar EPI
                    </button>
                  </div>
                </div>
              )}

              {/* 5S Specific Fields */}
              {inspectionType === "5S" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div className="bg-emerald-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-indigo-800 font-medium">Avalie cada item de 1 a 5, onde: 1 = Muito Ruim, 2 = Ruim, 3 = Regular, 4 = Bom, 5 = Muito Bom.</p>
                  </div>
                  
                  {[
                    "Paredes – limpeza e conservação",
                    "Pisos – limpeza e conservação",
                    "Teto – limpeza e conservação",
                    "Vidros – limpos e sem danos",
                    "Iluminação – funcionamento adequado",
                    "Portas/Janelas/Cortinas – limpeza e conservação",
                    "Banheiros – identificação, higiene e conservação",
                    "Placas e sinalizações visíveis",
                    "Extintores identificados e válidos",
                    "EPIs – uso correto e registro de entrega",
                    "Instalação elétrica – identificação e segurança",
                    "Organização de caixas (papelão/madeira/carretéis)"
                  ].map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white border border-gray-200 rounded-lg">
                      <label className="text-sm font-medium text-gray-700 flex-1">{index + 1}. {item}</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(score => (
                          <label key={score} className="flex flex-col items-center cursor-pointer">
                            <input 
                              type="radio" 
                              required 
                              name={`item${index + 1}`} 
                              value={score} 
                              onChange={handleInputChange}
                              className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500"
                            />
                            <span className="text-xs text-gray-500 mt-1">{score}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Incêndio Specific Fields */}
              {inspectionType === "Incêndio" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Equipamento (Opcional - Selecione da lista)</label>
                    <select 
                      name="equipment_id" 
                      onChange={(e) => {
                        const eq = equipment.find(eq => eq.id === parseInt(e.target.value));
                        if (eq) {
                          setFormData({ 
                            ...formData, 
                            equipment_type: eq.type, 
                            equipment_number: eq.equipment_number || "",
                            sector: eq.sector || formData.sector
                          });
                        }
                      }} 
                      className="w-full p-2 border border-gray-300 rounded-lg mb-2"
                    >
                      <option value="">Selecione um equipamento cadastrado...</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.id}>
                          {eq.equipment_number ? `#${eq.equipment_number} - ` : ''}{eq.type} ({eq.sector || 'Sem setor'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Equipamento/Sistema</label>
                      <input type="text" required name="equipment_type" value={formData.equipment_type || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Extintor, Hidrante..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número do Equipamento</label>
                      <input type="text" name="equipment_number" value={formData.equipment_number || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 01, 02..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Condição Geral do Equipamento</label>
                    <select required name="equipment_condition" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sinalização (Placas/Piso)</label>
                    <select required name="signaling" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acesso Desobstruído</label>
                    <select required name="unobstructed" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="">Selecione...</option>
                      <option value="Conforme">Conforme</option>
                      <option value="Não Conforme">Não Conforme</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Empilhadeira Combustão Specific Fields */}
              {inspectionType === "Empilhadeira Combustão" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificação do Equipamento</label>
                    <input required type="text" name="equipment_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nº da Frota ou Placa" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Freios (Pé e Mão)</label>
                      <select required name="brakes" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pneus (Desgaste/Pressão)</label>
                      <select required name="tires" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Luzes (Farol/Giroflex/Ré)</label>
                      <select required name="lights" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Buzina / Alarme de Ré</label>
                      <select required name="horn" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cinto de Segurança</label>
                      <select required name="seatbelt" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fluidos (Óleo/Água/Combustível)</label>
                      <select required name="fluids" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Empilhadeira Elétrica Specific Fields */}
              {inspectionType === "Empilhadeira Elétrica" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificação do Equipamento</label>
                    <input required type="text" name="equipment_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nº da Frota ou Placa" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Freios (Pé e Mão)</label>
                      <select required name="brakes" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pneus (Desgaste/Pressão)</label>
                      <select required name="tires" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Luzes (Farol/Giroflex/Ré)</label>
                      <select required name="lights" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Buzina / Alarme de Ré</label>
                      <select required name="horn" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cinto de Segurança</label>
                      <select required name="seatbelt" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bateria (Nível de Água/Cabos)</label>
                      <select required name="battery" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Esmerilhadeira Specific Fields */}
              {inspectionType === "Esmerilhadeira" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificação do Equipamento</label>
                    <input required type="text" name="equipment_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="TAG ou Número de Série" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carenagem de Proteção</label>
                      <select required name="casing" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cabo Elétrico (Sem emendas)</label>
                      <select required name="cable" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Disco (Desgaste/Trincas/Validade)</label>
                      <select required name="disc" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Empunhadura Lateral</label>
                      <select required name="handle" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plugue (Padrão ABNT)</label>
                      <select required name="plug" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Solda MIG Specific Fields */}
              {inspectionType === "Solda MIG" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificação da Máquina</label>
                    <input required type="text" name="equipment_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="TAG ou Número de Série" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cabos Elétricos (Sem emendas)</label>
                      <select required name="cables" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tocha e Bocal</label>
                      <select required name="torch" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cilindro de Gás (Fixação)</label>
                      <select required name="gas_cylinder" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Regulador de Pressão / Manômetros</label>
                      <select required name="regulator" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Garra Negativa (Aterramento)</label>
                      <select required name="ground_clamp" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Solda Elétrica Specific Fields */}
              {inspectionType === "Solda Elétrica" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificação da Máquina</label>
                    <input required type="text" name="equipment_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="TAG ou Número de Série" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cabos Elétricos (Sem emendas)</label>
                      <select required name="cables" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Porta-Eletrodo</label>
                      <select required name="electrode_holder" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Garra Negativa (Aterramento)</label>
                      <select required name="ground_clamp" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plugue (Padrão Industrial/ABNT)</label>
                      <select required name="plug" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Mecânicos Specific Fields */}
              {inspectionType === "Mecânicos" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Mecânico</label>
                    <input required type="text" name="employee_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ferramentas Manuais (Condição)</label>
                      <select required name="hand_tools" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ferramentas Pneumáticas (Conexões/Mangueiras)</label>
                      <select required name="pneumatic_tools" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Talhas e Cintas de Elevação</label>
                      <select required name="hoists" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Uso de EPIs (Óculos, Luvas, Botina)</label>
                      <select required name="ppe_usage" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Organização do Posto de Trabalho</label>
                      <select required name="organization" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Fornecedores/Terceirizados Specific Fields */}
              {inspectionType === "Fornecedores/Terceirizados" && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa Fornecedora/Terceirizada</label>
                      <input required type="text" name="company_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Trabalhador</label>
                      <input required type="text" name="worker_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                      <select required name="worker_type" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Fornecedor">Fornecedor</option>
                        <option value="Terceirizado">Terceirizado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Recebeu instruções de uso de EPI nas dependências?</label>
                      <select required name="received_epi_instructions" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Recebeu treinamento?</label>
                      <select required name="received_training" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Participou da integração?</label>
                      <select required name="participated_integration" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tem os EPIs necessários para executar as atividades?</label>
                      <select required name="has_necessary_epis" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precisa preencher Permissão de Trabalho (PT)?</label>
                      <select required name="needs_work_permit" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                        <option value="">Selecione...</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição da atividade que será executada</label>
                    <textarea required name="activity_description" onChange={handleInputChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"></textarea>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do colaborador que irá acompanhar</label>
                      <input required type="text" name="accompanier_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Função do colaborador que irá acompanhar</label>
                      <input required type="text" name="accompanier_role" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações Adicionais</label>
                <textarea name="observations" onChange={handleInputChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"></textarea>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-200 pt-6 mt-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-emerald-600" />
                    Assinatura do Técnico de SST
                  </h4>
                  <div className="border border-gray-300 bg-white rounded-lg mb-4">
                    <SignatureCanvas 
                      ref={techSigRef} 
                      canvasProps={{className: 'w-full h-40 rounded-lg'}} 
                      backgroundColor="white"
                    />
                  </div>
                  <button type="button" onClick={() => techSigRef.current?.clear()} className="text-sm text-red-600 hover:underline mb-4">Limpar Assinatura</button>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Técnico</label>
                      <input required type="text" name="tech_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cargo</label>
                      <input required type="text" name="tech_role" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" defaultValue="Técnico de Segurança do Trabalho" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-emerald-600" />
                    Assinatura do Inspecionado / Gerente
                  </h4>
                  <div className="border border-gray-300 bg-white rounded-lg mb-4">
                    <SignatureCanvas 
                      ref={inspectedSigRef} 
                      canvasProps={{className: 'w-full h-40 rounded-lg'}} 
                      backgroundColor="white"
                    />
                  </div>
                  <button type="button" onClick={() => inspectedSigRef.current?.clear()} className="text-sm text-red-600 hover:underline mb-4">Limpar Assinatura</button>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Inspecionado / Gerente</label>
                      <input required type="text" name="inspected_name" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cargo / Setor</label>
                      <input required type="text" name="inspected_role" onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
                  <Save className="w-5 h-5" />
                  Salvar Inspeção
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === "list" && (
        <div className="space-y-8">
          {/* Incêndio Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-red-900">Planilha de Controle: Prevenção de Incêndio (NR-23/CBMRS)</h3>
              <a href="/incendio" className="text-sm font-medium text-red-600 hover:text-red-800 bg-white px-3 py-1 rounded border border-red-200">Ver Relatórios</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Equipamento</th>
                    <th className="p-3 font-medium">Condição</th>
                    <th className="p-3 font-medium">Sinalização</th>
                    <th className="p-3 font-medium">Desobstruído</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fireData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">
                        <SectorBadge sector={item.sector} />
                      </td>
                      <td className="p-3 font-medium">{item.equipment_type}</td>
                      <td className="p-3"><StatusBadge status={item.equipment_condition} /></td>
                      <td className="p-3"><StatusBadge status={item.signaling} /></td>
                      <td className="p-3"><StatusBadge status={item.unobstructed} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {fireData.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-gray-500">Nenhuma inspeção de incêndio registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empilhadeira Combustão Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-yellow-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-yellow-900">Planilha de Controle: Empilhadeira a Combustão</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Equipamento</th>
                    <th className="p-3 font-medium">Freios</th>
                    <th className="p-3 font-medium">Pneus</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {empCombustaoData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3"><SectorBadge sector={item.sector} /></td>
                      <td className="p-3 font-medium">{item.equipment_name}</td>
                      <td className="p-3"><StatusBadge status={item.brakes} /></td>
                      <td className="p-3"><StatusBadge status={item.tires} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {empCombustaoData.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empilhadeira Elétrica Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-yellow-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-yellow-900">Planilha de Controle: Empilhadeira Elétrica</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Equipamento</th>
                    <th className="p-3 font-medium">Freios</th>
                    <th className="p-3 font-medium">Bateria</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {empEletricaData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3"><SectorBadge sector={item.sector} /></td>
                      <td className="p-3 font-medium">{item.equipment_name}</td>
                      <td className="p-3"><StatusBadge status={item.brakes} /></td>
                      <td className="p-3"><StatusBadge status={item.battery} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {empEletricaData.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Esmerilhadeira Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Planilha de Controle: Esmerilhadeira</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Equipamento</th>
                    <th className="p-3 font-medium">Carenagem</th>
                    <th className="p-3 font-medium">Cabo</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {esmerilhadeiraData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3"><SectorBadge sector={item.sector} /></td>
                      <td className="p-3 font-medium">{item.equipment_name}</td>
                      <td className="p-3"><StatusBadge status={item.casing} /></td>
                      <td className="p-3"><StatusBadge status={item.cable} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {esmerilhadeiraData.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Solda MIG Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-emerald-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-blue-900">Planilha de Controle: Solda MIG</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Equipamento</th>
                    <th className="p-3 font-medium">Tocha</th>
                    <th className="p-3 font-medium">Cilindro</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {soldaMigData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3"><SectorBadge sector={item.sector} /></td>
                      <td className="p-3 font-medium">{item.equipment_name}</td>
                      <td className="p-3"><StatusBadge status={item.torch} /></td>
                      <td className="p-3"><StatusBadge status={item.gas_cylinder} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {soldaMigData.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Solda Elétrica Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-emerald-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-blue-900">Planilha de Controle: Solda Elétrica</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Equipamento</th>
                    <th className="p-3 font-medium">Porta-Eletrodo</th>
                    <th className="p-3 font-medium">Garra Negativa</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {soldaEletricaData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3"><SectorBadge sector={item.sector} /></td>
                      <td className="p-3 font-medium">{item.equipment_name}</td>
                      <td className="p-3"><StatusBadge status={item.electrode_holder} /></td>
                      <td className="p-3"><StatusBadge status={item.ground_clamp} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {soldaEletricaData.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mecânicos Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-slate-100 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Planilha de Controle: Funções Mecânicas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Mecânico</th>
                    <th className="p-3 font-medium">Ferr. Manuais</th>
                    <th className="p-3 font-medium">Uso de EPIs</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mecanicosData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3"><SectorBadge sector={item.sector} /></td>
                      <td className="p-3 font-medium">{item.employee_name}</td>
                      <td className="p-3"><StatusBadge status={item.hand_tools} /></td>
                      <td className="p-3"><StatusBadge status={item.ppe_usage} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {mecanicosData.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5S Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-emerald-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-indigo-900">Planilha de Controle: Programa 5S</h3>
              <a href="/relatorios-5s" className="text-sm font-medium text-emerald-600 hover:text-indigo-800 bg-white px-3 py-1 rounded border border-indigo-200">Ver Relatórios 5S</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Líder</th>
                    <th className="p-3 font-medium text-center">Pontuação</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data5s.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">
                        <SectorBadge sector={item.sector} />
                      </td>
                      <td className="p-3">{item.leader}</td>
                      <td className="p-3 text-center">
                        <span className={clsx(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          item.total_score >= 90 ? "bg-emerald-100 text-emerald-800" :
                          item.total_score >= 70 ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        )}>
                          {item.total_score.toFixed(1)} / 100
                        </span>
                      </td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {data5s.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhuma inspeção 5S registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NR-10 Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-emerald-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-blue-900">Planilha de Controle: NR-10 (Elétrica)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Painel</th>
                    <th className="p-3 font-medium">Aterramento</th>
                    <th className="p-3 font-medium">Sinalização</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {nr10Data.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">
                        <SectorBadge sector={item.sector} />
                      </td>
                      <td className="p-3"><StatusBadge status={item.panel_condition} /></td>
                      <td className="p-3"><StatusBadge status={item.grounding} /></td>
                      <td className="p-3"><StatusBadge status={item.signaling} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {nr10Data.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção NR-10 registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NR-12 Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-orange-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-orange-900">Planilha de Controle: NR-12 (Máquinas)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Máquina</th>
                    <th className="p-3 font-medium">Botão Emerg.</th>
                    <th className="p-3 font-medium">Proteções</th>
                    <th className="p-3 font-medium">Intertravamento</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {nr12Data.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">{item.machine_name}</td>
                      <td className="p-3"><StatusBadge status={item.emergency_button} /></td>
                      <td className="p-3"><StatusBadge status={item.safety_guards} /></td>
                      <td className="p-3"><StatusBadge status={item.interlock_system} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {nr12Data.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção NR-12 registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NR-24 Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-emerald-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-emerald-900">Planilha de Controle: NR-24 (Sanitários)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Localização</th>
                    <th className="p-3 font-medium">Limpeza</th>
                    <th className="p-3 font-medium">Armários</th>
                    <th className="p-3 font-medium">Chuveiros/Pias</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {nr24Data.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">{item.location}</td>
                      <td className="p-3"><StatusBadge status={item.cleanliness} /></td>
                      <td className="p-3"><StatusBadge status={item.lockers_condition} /></td>
                      <td className="p-3"><StatusBadge status={item.showers_condition} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {nr24Data.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção NR-24 registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NR-35 Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-purple-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-purple-900">Planilha de Controle: NR-35 (Trabalho em Altura)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Local</th>
                    <th className="p-3 font-medium">Ancoragem</th>
                    <th className="p-3 font-medium">Linhas de Vida</th>
                    <th className="p-3 font-medium">Cinturões</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {nr35Data.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">{item.location}</td>
                      <td className="p-3"><StatusBadge status={item.anchor_points} /></td>
                      <td className="p-3"><StatusBadge status={item.lifelines} /></td>
                      <td className="p-3"><StatusBadge status={item.harnesses} /></td>
                      <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                    </tr>
                  ))}
                  {nr35Data.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma inspeção NR-35 registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NR-6 Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-teal-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-teal-900">Planilha de Controle: NR-6 (EPIs)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Setor</th>
                    <th className="p-3 font-medium">Colaborador</th>
                    <th className="p-3 font-medium">Qtd. EPIs</th>
                    <th className="p-3 font-medium text-center">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {nr6Data.map(item => {
                    let ppesCount = 0;
                    try {
                      if (item.ppes_list) {
                        const parsed = JSON.parse(item.ppes_list);
                        ppesCount = Array.isArray(parsed) ? parsed.length : 0;
                      }
                    } catch (e) {}

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                        <td className="p-3">{item.inspector}</td>
                        <td className="p-3">
                          <SectorBadge sector={item.sector} />
                        </td>
                        <td className="p-3">{item.employee_name || "-"}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {ppesCount} EPI(s)
                          </span>
                        </td>
                        <td className="p-3 text-center"><PhotoLinks location={item.photo_location} nonconformity={item.photo_nonconformity} /></td>
                      </tr>
                    );
                  })}
                  {nr6Data.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhuma inspeção NR-6 registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
      status === "Conforme" ? "bg-emerald-100 text-emerald-800" :
      status === "Não Conforme" ? "bg-red-100 text-red-800" :
      "bg-gray-100 text-gray-800"
    )}>
      {status}
    </span>
  );
}

function PhotoLinks({ location, nonconformity }: { location?: string, nonconformity?: string }) {
  if (!location && !nonconformity) return <span className="text-gray-400">-</span>;
  
  const openImage = (src: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<img src="${src}" style="max-width: 100%; height: auto;" />`);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2">
      {location && (
        <button onClick={() => openImage(location)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition" title="Ver Foto do Local/Máquina">
          <Camera className="w-4 h-4" />
        </button>
      )}
      {nonconformity && (
        <button onClick={() => openImage(nonconformity)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition" title="Ver Foto da Não Conformidade">
          <AlertCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
