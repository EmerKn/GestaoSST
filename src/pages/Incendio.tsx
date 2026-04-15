import { useState, useEffect, useRef } from "react";
import { Flame, ShieldAlert, Plus, ShieldCheck, Printer, Users, Bell, AlertTriangle, Activity, Camera, X, Trash2, Droplet, FileText, TrendingUp, TrendingDown, Minus, Save } from "lucide-react";
import { format, addMonths, startOfDay, startOfWeek, startOfMonth, startOfYear, isSameDay, isSameWeek, isSameMonth, isSameYear, parseISO, subMonths, subYears } from "date-fns";
import { clsx } from "clsx";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, CompanySettings, addStandardHeaderToPDF, addStandardFooterToPDF } from "../utils/pdfUtils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { ImageUpload } from "../components/ImageUpload";
import { useDatabaseOptions } from "../hooks/useDatabaseOptions";
import { SelectWithNew } from "../components/SelectWithNew";

interface FireInspection {
  id: number;
  date: string;
  inspector: string;
  sector: string;
  equipment_type: string;
  equipment_condition: string;
  signaling: string;
  unobstructed: string;
  photo_location: string;
  photo_nonconformity: string;
  observations: string;
}

interface EvacuationTest {
  id: number;
  date: string;
  next_test: string;
  status: string;
  observations: string;
  photo_url: string;
}

interface EvacuationDrill {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  total_duration: string;
  shift: string;
  location: string;
  simulation_description: string;
  emergency_response: string;
  strong_points: string;
  improvement_points: string;
  brigade_members: string[];
  drill_type?: string;
  created_at?: string;
}

interface DrillOrganogramRoles {
  role1_call: string;
  role2_smell: string;
  role3_fight_initial: string;
  role4_alarm: string;
  role5_inform_firefighters: string;
  role6_fight_fire: string[];
  role7_evacuation: { name: string; area: string }[];
  role8_signaling_sectors: { name: string; area: string }[];
  role9_power_shutdown: string;
  role10_signaling_meeting_point: string[];
  role11_signaling_gate: string;
  role12_final_word: string;
  extras_help: { helper: string; person_helped: string }[];
}

interface DrillOrganogram {
  id?: number;
  drill_id: number;
  roles: DrillOrganogramRoles;
}

interface HydrantTest {
  id: string;
  test_date: string;
  hydrant_name: string;
  location: string;
  participants: string[];
  photo_url: string;
  check_hydrant: boolean;
  check_hoses: boolean;
  check_storz_key: boolean;
  observations: string;
}

interface BrigadeMember {
  id: number;
  employee_id: number;
  brigade_role: string;
  name: string;
  photo_url: string;
  role: string;
  sector: string;
  shift: string;
}

const EQUIPMENT_TYPES = [
  "Extintor",
  "Hidrante",
  "Mangueira",
  "Detector de Fumaça",
  "Sprinkler",
  "Botoeira",
  "Sirene",
  "Alarme de Incêndio",
  "Central de Incêndio"
];

export default function Incendio() {
  const { sectors } = useDatabaseOptions();
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit && !isMobile;
  const [inspections, setInspections] = useState<FireInspection[]>([]);
  const [evacuationTests, setEvacuationTests] = useState<EvacuationTest[]>([]);
  const [evacuationDrills, setEvacuationDrills] = useState<EvacuationDrill[]>([]);
  const [hydrantTests, setHydrantTests] = useState<HydrantTest[]>([]);
  const [brigade, setBrigade] = useState<BrigadeMember[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [showOrganograma, setShowOrganograma] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const [showTestModal, setShowTestModal] = useState(false);
  const [testData, setTestData] = useState<Partial<EvacuationTest>>({
    date: format(new Date(), "yyyy-MM-dd"),
    next_test: format(addMonths(new Date(), 6), "yyyy-MM-dd"),
    status: "Realizado com Sucesso"
  });

  const [showDrillModal, setShowDrillModal] = useState(false);
  const [drillData, setDrillData] = useState<Partial<EvacuationDrill>>({
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "16:30",
    end_time: "16:40",
    total_duration: "00:10:30",
    shift: "Dia",
    location: "",
    simulation_description: "",
    emergency_response: "",
    strong_points: "",
    improvement_points: "",
    brigade_members: [],
    drill_type: "Abandono de Área"
  });

  const [showOrganogramModal, setShowOrganogramModal] = useState(false);
  const [selectedDrillForOrganogram, setSelectedDrillForOrganogram] = useState<EvacuationDrill | null>(null);
  const [organogramData, setOrganogramData] = useState<DrillOrganogramRoles>({
    role1_call: "",
    role2_smell: "",
    role3_fight_initial: "",
    role4_alarm: "",
    role5_inform_firefighters: "",
    role6_fight_fire: [],
    role7_evacuation: [],
    role8_signaling_sectors: [],
    role9_power_shutdown: "",
    role10_signaling_meeting_point: [],
    role11_signaling_gate: "",
    role12_final_word: "",
    extras_help: []
  });

  const [showBrigadeModal, setShowBrigadeModal] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [newBrigadeMember, setNewBrigadeMember] = useState({
    employee_id: "",
    brigade_role: "Combate a Incêndio"
  });

  const [showHydrantTestModal, setShowHydrantTestModal] = useState(false);
  const [hydrantTestData, setHydrantTestData] = useState<Partial<HydrantTest>>({
    test_date: format(new Date(), "yyyy-MM-dd"),
    hydrant_name: "",
    location: "",
    participants: [],
    check_hydrant: false,
    check_hoses: false,
    check_storz_key: false,
    observations: "",
    photo_url: ""
  });

  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [equipmentData, setEquipmentData] = useState<any>({
    type: "Extintor",
    location: "",
    sector: "",
    quantity: 1,
    equipment_number: "",
    status: "Ativo",
    next_inspection: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
    hydrostatic_test: format(addMonths(new Date(), 60), "yyyy-MM-dd"),
    photo_url: ""
  });

  const handleEquipmentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEquipmentData({ ...equipmentData, [name]: value });
  };

  const handleEquipmentFileChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEquipmentData({ ...equipmentData, photo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('fire_equipment').insert([equipmentData]);
      if (error) throw error;
      
      setShowEquipmentModal(false);
      setEquipmentData({
        type: "Extintor",
        location: "",
        sector: "",
        quantity: 1,
        equipment_number: "",
        status: "Ativo",
        next_inspection: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
        hydrostatic_test: format(addMonths(new Date(), 60), "yyyy-MM-dd"),
        photo_url: ""
      });
      loadData();
    } catch (error) {
      console.error("Error saving equipment:", error);
      alert("Erro ao salvar equipamento.");
    }
  };

  const [brigadeTrainings, setBrigadeTrainings] = useState<any[]>([]);

  const organogramaRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: organogramaRef,
    documentTitle: "Organograma_Brigada_Emergencia",
  });

  const loadData = async () => {
    try {
      const [inspRes, testsRes, drillsRes, brigadeRes, eqRes, settingsRes, hydrantRes, trainingsRes, employeesRes] = await Promise.all([
        supabase.from('inspection_fire').select('*').order('date', { ascending: false }),
        supabase.from('evacuation_tests').select('*').order('date', { ascending: false }),
        supabase.from('evacuation_drills').select('*').order('date', { ascending: false }),
        supabase.from('brigade_members').select('*, employees(name, sector, role, shift, photo_url)'),
        supabase.from('fire_equipment').select('*').order('sector'),
        fetchSettings(),
        supabase.from('hydrant_tests').select('*').order('test_date', { ascending: false }),
        supabase.from('brigade_training_schedules').select('*').order('date', { ascending: true }),
        supabase.from('employees').select('id, name, sector, role, shift').order('name', { ascending: true })
      ]);

      if (inspRes.data) setInspections(filterRealData(inspRes.data));
      if (testsRes.data) setEvacuationTests(filterRealData(testsRes.data));
      if (drillsRes.data) {
        setEvacuationDrills(filterRealData(drillsRes.data).map((d: any) => ({
          ...d,
          brigade_members: typeof d.brigade_members === 'string' ? JSON.parse(d.brigade_members) : d.brigade_members
        })));
      }
      if (hydrantRes.data) setHydrantTests(filterRealData(hydrantRes.data));
      if (trainingsRes.data) setBrigadeTrainings(trainingsRes.data);
      if (employeesRes.data) setAllEmployees(filterRealData(employeesRes.data));
      if (brigadeRes.data) {
        const realBrigade = filterRealData(brigadeRes.data);
        const formattedBrigade = realBrigade.map(member => ({
          ...member,
          name: member.employees?.name,
          sector: member.employees?.sector,
          role: member.employees?.role,
          shift: member.employees?.shift,
          photo_url: member.employees?.photo_url
        }));
        setBrigade(formattedBrigade);
      }
      if (eqRes.data) setEquipment(filterRealData(eqRes.data));
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading fire prevention data:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTestData({ ...testData, [name]: value });
  };

  const handleFileChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTestData({ ...testData, photo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('evacuation_tests').insert([testData]);
      if (error) throw error;
      
      setShowTestModal(false);
      setTestData({
        date: format(new Date(), "yyyy-MM-dd"),
        next_test: format(addMonths(new Date(), 6), "yyyy-MM-dd"),
        status: "Realizado com Sucesso"
      });
      loadData();
    } catch (error) {
      console.error("Error saving evacuation test:", error);
      alert("Erro ao salvar teste de evacuação.");
    }
  };

  const handleDeleteTest = async (id: number) => {
    if (confirm("Excluir teste?")) {
      try {
        const { error } = await supabase.from('evacuation_tests').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting evacuation test:", error);
        alert("Erro ao excluir teste de evacuação.");
      }
    }
  };

  const handleDrillChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDrillData({ ...drillData, [name]: value });
  };

  const handleDrillParticipantToggle = (name: string) => {
    const current = drillData.brigade_members || [];
    if (current.includes(name)) {
      setDrillData({ ...drillData, brigade_members: current.filter(p => p !== name) });
    } else {
      setDrillData({ ...drillData, brigade_members: [...current, name] });
    }
  };

  const handleDrillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...drillData,
        brigade_members: JSON.stringify(drillData.brigade_members)
      };
      const { error } = await supabase.from('evacuation_drills').insert([payload]);
      if (error) throw error;
      
      setShowDrillModal(false);
      setDrillData({
        date: format(new Date(), "yyyy-MM-dd"),
        start_time: "16:30",
        end_time: "16:40",
        total_duration: "00:10:30",
        shift: "Dia",
        location: "",
        simulation_description: "",
        emergency_response: "",
        strong_points: "",
        improvement_points: "",
        brigade_members: [],
        drill_type: "Abandono de Área"
      });
      loadData();
    } catch (error) {
      console.error("Error saving evacuation drill:", error);
      alert("Erro ao salvar relatório de simulado.");
    }
  };

  const handleDeleteDrill = async (id: number) => {
    if (confirm("Excluir relatório de simulado?")) {
      try {
        const { error } = await supabase.from('evacuation_drills').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting evacuation drill:", error);
        alert("Erro ao excluir relatório de simulado.");
      }
    }
  };

  const handleOpenOrganogramModal = async (drill: EvacuationDrill) => {
    setSelectedDrillForOrganogram(drill);
    try {
      const { data, error } = await supabase.from('drill_organograms').select('*').eq('drill_id', drill.id).single();
      if (data && data.roles) {
        setOrganogramData(data.roles);
      } else {
        // Reset to default
        setOrganogramData({
          role1_call: "",
          role2_smell: "",
          role3_fight_initial: "",
          role4_alarm: "",
          role5_inform_firefighters: "",
          role6_fight_fire: [],
          role7_evacuation: [],
          role8_signaling_sectors: [],
          role9_power_shutdown: "",
          role10_signaling_meeting_point: [],
          role11_signaling_gate: "",
          role12_final_word: "",
          extras_help: []
        });
      }
    } catch (e) {
      console.error("Error fetching organogram:", e);
    }
    setShowOrganogramModal(true);
  };

  const handleSaveOrganogram = async () => {
    if (!selectedDrillForOrganogram) return;
    try {
      const { data: existing } = await supabase.from('drill_organograms').select('id').eq('drill_id', selectedDrillForOrganogram.id).single();
      
      if (existing) {
        await supabase.from('drill_organograms').update({ roles: organogramData }).eq('id', existing.id);
      } else {
        await supabase.from('drill_organograms').insert([{ drill_id: selectedDrillForOrganogram.id, roles: organogramData }]);
      }
      alert("Organograma salvo com sucesso!");
      setShowOrganogramModal(false);
    } catch (e) {
      console.error("Error saving organogram:", e);
      alert("Erro ao salvar organograma.");
    }
  };

  const handleBrigadeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrigadeMember.employee_id) return;
    try {
      const { error } = await supabase.from('brigade_members').insert([newBrigadeMember]);
      if (error) throw error;
      setNewBrigadeMember({ employee_id: "", brigade_role: "Combate a Incêndio" });
      loadData();
    } catch (error) {
      console.error("Error saving brigade member:", error);
      alert("Erro ao salvar membro da brigada.");
    }
  };

  const handleDeleteBrigadeMember = async (id: number) => {
    if (!confirm("Remover este colaborador da brigada?")) return;
    try {
      const { error } = await supabase.from('brigade_members').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error deleting brigade member:", error);
      alert("Erro ao excluir membro da brigada.");
    }
  };

  const generateOrganogramPDF = async (drill: EvacuationDrill) => {
    try {
      const { data, error } = await supabase.from('drill_organograms').select('*').eq('drill_id', drill.id).single();
      if (error || !data || !data.roles) {
        alert("Organograma não encontrado. Por favor, preencha o organograma primeiro.");
        return;
      }

      const roles = data.roles as DrillOrganogramRoles;
      const doc = new jsPDF();
      let currentY = addStandardHeaderToPDF(doc, settings, "Funções dos Brigadistas para o Simulado de Abandono de Área");

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      
      const addLine = (text: string, indent = 0) => {
        if (currentY > 270) {
          addStandardFooterToPDF(doc, settings, 280);
          doc.addPage();
          currentY = 20;
        }
        doc.text(text, 14 + indent, currentY);
        currentY += 7;
      };

      addLine(`1- ${roles.role1_call || '____________________'} (Ligação)`);
      addLine(`2- ${roles.role2_smell || '____________________'} sentir cheiro de queimado`);
      addLine(`3- ${roles.role3_fight_initial || '____________________'} combater o princípio de incêndio com CO2`);
      addLine(`4- ${roles.role4_alarm || '____________________'}, aciona a botoeira de incêndio`);
      addLine(`5- ${roles.role5_inform_firefighters || '____________________'} informa local do incêndio e liga para os bombeiros`);
      
      addLine(`6- Combater o incêndio`);
      if (roles.role6_fight_fire && roles.role6_fight_fire.length > 0) {
        roles.role6_fight_fire.forEach(p => addLine(`• ${p}`, 5));
      } else {
        addLine(`• ____________________`, 5);
      }

      addLine(`7- Realizar evacuação nos banheiros, salas, setores e administrativo`);
      if (roles.role7_evacuation && roles.role7_evacuation.length > 0) {
        roles.role7_evacuation.forEach(item => addLine(`• ${item.name} – ${item.area}`, 5));
      } else {
        addLine(`• ____________________ – ____________________`, 5);
      }

      addLine(`8- Sinalizar setores orientando até o ponto de encontro`);
      if (roles.role8_signaling_sectors && roles.role8_signaling_sectors.length > 0) {
        roles.role8_signaling_sectors.forEach(item => addLine(`• ${item.name} – ${item.area}`, 5));
      } else {
        addLine(`• ____________________ – ____________________`, 5);
      }

      addLine(`9- Simulando o desligamento da energia geral (${roles.role9_power_shutdown || '____________________'})`);
      
      addLine(`10- Sinalização no ponto de encontro (${(roles.role10_signaling_meeting_point || []).join(', ') || '____________________'})`);
      
      addLine(`11- Sinalizando no portão com 2 cones sobre o meio do portão (${roles.role11_signaling_gate || '____________________'}),`);
      addLine(`para informar a entrada dos bombeiros`, 5);
      
      addLine(`12- Palavra final (${roles.role12_final_word || '____________________'})`);

      currentY += 5;
      if (roles.extras_help && roles.extras_help.length > 0) {
        roles.extras_help.forEach(item => {
          doc.setFont("helvetica", "bold");
          addLine(`Ajudar a ${item.person_helped} – ${item.helper}`);
          doc.setFont("helvetica", "normal");
        });
      }

      addStandardFooterToPDF(doc, settings, 280);
      doc.save(`Organograma_Simulado_${format(parseISO(drill.date), "yyyyMMdd")}.pdf`);
    } catch (e) {
      console.error("Error generating organogram PDF:", e);
      alert("Erro ao gerar PDF do organograma.");
    }
  };

  const handleHydrantTestChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setHydrantTestData({ ...hydrantTestData, [name]: checked });
    } else {
      setHydrantTestData({ ...hydrantTestData, [name]: value });
    }
  };

  const handleHydrantParticipantToggle = (name: string) => {
    const current = hydrantTestData.participants || [];
    if (current.includes(name)) {
      setHydrantTestData({ ...hydrantTestData, participants: current.filter(p => p !== name) });
    } else {
      setHydrantTestData({ ...hydrantTestData, participants: [...current, name] });
    }
  };

  const handleHydrantFileChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHydrantTestData({ ...hydrantTestData, photo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHydrantTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('hydrant_tests').insert([hydrantTestData]);
      if (error) throw error;
      
      setShowHydrantTestModal(false);
      setHydrantTestData({
        test_date: format(new Date(), "yyyy-MM-dd"),
        hydrant_name: "",
        location: "",
        participants: [],
        check_hydrant: false,
        check_hoses: false,
        check_storz_key: false,
        observations: "",
        photo_url: ""
      });
      loadData();
    } catch (error) {
      console.error("Error saving hydrant test:", error);
      alert("Erro ao salvar teste de hidrante.");
    }
  };

  const handleDeleteHydrantTest = async (id: string) => {
    if (confirm("Excluir teste de hidrante?")) {
      try {
        const { error } = await supabase.from('hydrant_tests').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting hydrant test:", error);
        alert("Erro ao excluir teste de hidrante.");
      }
    }
  };

  const generateDrillPDF = (drill: EvacuationDrill) => {
    const doc = new jsPDF();
    const drillTitle = `RELATÓRIO DO SIMULADO DE ${drill.drill_type?.toUpperCase() || "ABANDONO DE ÁREA"}`;
    let currentY = addStandardHeaderToPDF(doc, settings, drillTitle);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Evento: Simulação de Emergência: ${drill.drill_type || "SIMULADO DE ABANDONO DE ÁREA"}`, 14, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Basic Info
    const basicInfo = [
      `Data: ${format(parseISO(drill.date), "dd/MM/yyyy")}`,
      `Horário inicial: ${drill.start_time}`,
      `Horário término: ${drill.end_time}`,
      `Duração: ${drill.total_duration}`,
      `Turno: ${drill.shift}`,
      `Local da Ocorrência: ${drill.location}`
    ];

    basicInfo.forEach(info => {
      doc.text(`• ${info}`, 14, currentY);
      currentY += 6;
    });
    currentY += 4;

    // Description
    doc.setFont("helvetica", "bold");
    doc.text("• Descrição da Simulação:", 14, currentY);
    currentY += 6;
    doc.setFont("helvetica", "normal");
    const splitDesc = doc.splitTextToSize(drill.simulation_description || "-", 180);
    doc.text(splitDesc, 14, currentY);
    currentY += (splitDesc.length * 5) + 4;

    // Emergency Response
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("• Atendimento a Emergência:", 14, currentY);
    currentY += 6;
    doc.setFont("helvetica", "normal");
    const splitResp = doc.splitTextToSize(drill.emergency_response || "-", 180);
    doc.text(splitResp, 14, currentY);
    currentY += (splitResp.length * 5) + 4;

    // Strong Points
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("• Pontos Fortes do Atendimento a Emergência:", 14, currentY);
    currentY += 6;
    doc.setFont("helvetica", "normal");
    const splitStrong = doc.splitTextToSize(drill.strong_points || "-", 180);
    doc.text(splitStrong, 14, currentY);
    currentY += (splitStrong.length * 5) + 4;

    // Improvement Points
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("• Pontos a Melhorar do Atendimento a Emergência:", 14, currentY);
    currentY += 6;
    doc.setFont("helvetica", "normal");
    const splitImprove = doc.splitTextToSize(drill.improvement_points || "-", 180);
    doc.text(splitImprove, 14, currentY);
    currentY += (splitImprove.length * 5) + 10;

    // Brigade Members
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("Brigadistas envolvidos no momento do Simulado:", 14, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    
    if (drill.brigade_members && drill.brigade_members.length > 0) {
      drill.brigade_members.forEach(member => {
        if (currentY > 270) { doc.addPage(); currentY = 20; }
        doc.text(member, 14, currentY);
        currentY += 5;
      });
    } else {
      doc.text("Nenhum brigadista registrado.", 14, currentY);
      currentY += 5;
    }

    // Signature Space
    currentY += 30;
    if (currentY > 250) { doc.addPage(); currentY = 40; }
    
    doc.line(60, currentY, 150, currentY);
    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.text(settings?.resp_name || "Responsável", 105, currentY, { align: "center" });
    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.text(settings?.resp_role || "Assinatura do Responsável", 105, currentY, { align: "center" });

    addStandardFooterToPDF(doc, settings, 280);
    
    // Use sequential number for filename if id exists
    const seqNumber = drill.id.toString().padStart(4, '0');
    const filenamePrefix = drill.drill_type?.replace(/\s+/g, '_') || "Simulado_Abandono";
    doc.save(`${filenamePrefix}_${seqNumber}_${format(parseISO(drill.date), "yyyyMMdd")}.pdf`);
  };

  const generateHydrantTestPDF = (test: HydrantTest) => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Teste de Hidrante");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Informações do Teste", 14, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data do Teste: ${format(parseISO(test.test_date), "dd/MM/yyyy")}`, 14, currentY);
    currentY += 6;
    doc.text(`Identificação do Hidrante: ${test.hydrant_name}`, 14, currentY);
    currentY += 6;
    doc.text(`Localização: ${test.location}`, 14, currentY);
    currentY += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Itens Verificados", 14, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`[ ${test.check_hydrant ? 'X' : ' '} ] Hidrante em boas condições e pressurizado`, 14, currentY);
    currentY += 6;
    doc.text(`[ ${test.check_hoses ? 'X' : ' '} ] Mangueiras inspecionadas e conectadas`, 14, currentY);
    currentY += 6;
    doc.text(`[ ${test.check_storz_key ? 'X' : ' '} ] Chave Storz presente no abrigo`, 14, currentY);
    currentY += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Brigadistas / Participantes", 14, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const participantsText = test.participants && test.participants.length > 0 
      ? test.participants.join(", ") 
      : "Nenhum participante registrado.";
    
    const splitParticipants = doc.splitTextToSize(participantsText, 180);
    doc.text(splitParticipants, 14, currentY);
    currentY += (splitParticipants.length * 5) + 5;

    if (test.observations) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Observações", 14, currentY);
      currentY += 8;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const splitObs = doc.splitTextToSize(test.observations, 180);
      doc.text(splitObs, 14, currentY);
      currentY += (splitObs.length * 5) + 5;
    }

    if (test.photo_url) {
      if (currentY > 200) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Registro Fotográfico", 14, currentY);
      currentY += 8;
      try {
        doc.addImage(test.photo_url, "JPEG", 14, currentY, 100, 75);
        currentY += 85;
      } catch (e) {
        console.warn("Could not add photo to PDF", e);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("(Erro ao carregar imagem)", 14, currentY);
        currentY += 10;
      }
    }

    addStandardFooterToPDF(doc, settings, currentY);
    doc.save(`Teste_Hidrante_${test.hydrant_name}_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const brigadeRolesCount = brigade.reduce((acc, member) => {
    acc[member.brigade_role] = (acc[member.brigade_role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const combateCount = (brigadeRolesCount["Combate a Incêndio"] || 0) + (brigadeRolesCount["Emergência"] || 0);
  const primeirosCount = brigadeRolesCount["Primeiros Socorros"] || 0;
  const somenteCount = (brigadeRolesCount["Abandono de Área"] || 0) + (brigadeRolesCount["Evacuação"] || 0);
  const totalBrigada = combateCount + primeirosCount + somenteCount + (brigadeRolesCount["Líder Diurno"] || 0) + (brigadeRolesCount["Líder Noturno"] || 0);

  // Inspections Reporting Logic
  const today = new Date();
  const stats = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    lastMonth: 0,
    thisYear: 0,
    lastYear: 0
  };

  inspections.forEach(insp => {
    if (!insp.date) return;
    const inspDate = parseISO(insp.date);
    if (isSameDay(inspDate, today)) stats.today++;
    if (isSameWeek(inspDate, today, { weekStartsOn: 1 })) stats.thisWeek++;
    if (isSameMonth(inspDate, today)) stats.thisMonth++;
    if (isSameMonth(inspDate, subMonths(today, 1))) stats.lastMonth++;
    if (isSameYear(inspDate, today)) stats.thisYear++;
    if (isSameYear(inspDate, subYears(today, 1))) stats.lastYear++;
  });

  const monthGrowth = stats.lastMonth === 0 ? (stats.thisMonth > 0 ? 100 : 0) : Math.round(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100);
  const yearGrowth = stats.lastYear === 0 ? (stats.thisYear > 0 ? 100 : 0) : Math.round(((stats.thisYear - stats.lastYear) / stats.lastYear) * 100);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-600" />
          Prevenção de Incêndio
        </h1>
      </div>

      {/* Brigade Section */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Resumo da Brigada
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowBrigadeModal(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Gerenciar Brigada</span>
            </button>
            <button 
              onClick={() => setShowOrganograma(!showOrganograma)}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition font-medium shadow-sm"
            >
              <Users className="w-4 h-4 text-purple-600" />
              <span>{showOrganograma ? "Ver Lista de Membros" : "Ver Organograma da Brigada"}</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg text-red-600">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Emergência</p>
              <p className="text-2xl font-bold text-gray-900">{combateCount}</p>
              <div className="mt-2 text-[10px] text-gray-500 max-h-20 overflow-y-auto border-t pt-1">
                {brigade.filter(m => m.brigade_role === "Combate a Incêndio" || m.brigade_role === "Emergência").map(m => (
                  <div key={m.id} className="truncate">• {m.name}</div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Primeiros Socorros</p>
              <p className="text-2xl font-bold text-gray-900">{primeirosCount}</p>
              <div className="mt-2 text-[10px] text-gray-500 max-h-20 overflow-y-auto border-t pt-1">
                {brigade.filter(m => m.brigade_role === "Primeiros Socorros").map(m => (
                  <div key={m.id} className="truncate">• {m.name}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Evacuação</p>
              <p className="text-2xl font-bold text-gray-900">{somenteCount}</p>
              <div className="mt-2 text-[10px] text-gray-500 max-h-20 overflow-y-auto border-t pt-1">
                {brigade.filter(m => m.brigade_role === "Abandono de Área" || m.brigade_role === "Evacuação").map(m => (
                  <div key={m.id} className="truncate">• {m.name}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-xl shadow-md flex items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80 uppercase tracking-wider">Brigada de Emergência</p>
              <p className="text-2xl font-bold">{totalBrigada}</p>
            </div>
          </div>
        </div>

        {showOrganograma ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <div className="flex justify-end mb-4">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                <Printer className="w-4 h-4" />
                <span>Imprimir Organograma</span>
              </button>
            </div>
            <div ref={organogramaRef} className="min-w-[800px] p-8 bg-white">
              <div className="text-center mb-12">
                <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wider mb-2">Organograma da Brigada de Emergência</h2>
                <p className="text-gray-600">{settings?.company_name || "SST Gestão"}</p>
              </div>

              <div className="flex flex-col items-center">
                {/* Coordinator */}
                <div className="bg-red-50 border-2 border-red-200 p-4 rounded-xl w-64 text-center relative z-10 shadow-sm">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-red-300">
                    <ShieldCheck className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="font-bold text-red-900 uppercase text-sm mb-1">Coordenador da Brigada</h3>
                  <p className="font-bold text-gray-900">{settings?.resp_name || "Responsável SST"}</p>
                  <p className="text-sm text-gray-600">{settings?.resp_role || "Engenheiro/Técnico de Segurança"}</p>
                </div>

                {/* Vertical Line */}
                <div className="w-0.5 h-8 bg-gray-300"></div>

                {/* Horizontal Line connecting Leaders */}
                <div className="w-full max-w-5xl h-0.5 bg-gray-300 relative">
                  <div className="absolute left-1/4 top-0 w-0.5 h-6 bg-gray-300 -translate-x-1/2"></div>
                  <div className="absolute right-1/4 top-0 w-0.5 h-6 bg-gray-300 translate-x-1/2"></div>
                </div>

                {/* Leaders Row */}
                <div className="flex justify-between w-full max-w-5xl mt-6 px-4">
                  
                  {/* Diurno Section */}
                  <div className="flex flex-col items-center w-1/2 px-2">
                    {/* Leader Diurno dynamic box */}
                    {brigade.filter(m => m.brigade_role === "Líder Diurno").length > 0 ? (
                      brigade.filter(m => m.brigade_role === "Líder Diurno").map(leader => (
                        <div key={leader.id} className="bg-blue-50 border-2 border-blue-200 p-3 rounded-xl w-48 text-center relative z-10 shadow-sm mb-4">
                          <h3 className="font-bold text-blue-900 uppercase text-[10px] mb-1">Líder Diurno</h3>
                          <p className="font-bold text-gray-900 text-xs">{leader.name}</p>
                          <p className="text-[10px] text-gray-500">{leader.sector}</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-blue-50 border-2 border-blue-200 p-3 rounded-xl w-48 text-center relative z-10 shadow-sm mb-4">
                        <h3 className="font-bold text-blue-900 uppercase text-sm">Líder Diurno</h3>
                        <p className="text-gray-400 text-xs italic">Não definido</p>
                      </div>
                    )}

                    {/* Vertical Line from Diurno Leader */}
                    <div className="w-0.5 h-6 bg-gray-300"></div>

                    {/* Horizontal Line for Diurno Teams */}
                    <div className="w-full h-0.5 bg-gray-300 relative">
                      <div className="absolute left-[16.66%] top-0 w-0.5 h-6 bg-gray-300 -translate-x-1/2"></div>
                      <div className="absolute left-1/2 top-0 w-0.5 h-6 bg-gray-300 -translate-x-1/2"></div>
                      <div className="absolute right-[16.66%] top-0 w-0.5 h-6 bg-gray-300 translate-x-1/2"></div>
                    </div>

                    {/* Diurno Teams */}
                    <div className="flex justify-between w-full mt-6 gap-2">
                      {/* Combate a Incêndio */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="bg-orange-50 border border-orange-200 p-2 rounded-lg w-full text-center mb-3 shadow-sm">
                          <h4 className="font-bold text-orange-800 text-xs">Combate a Incêndio</h4>
                        </div>
                        <div className="space-y-2 w-full">
                          {brigade.filter(m => (m.brigade_role === "Combate a Incêndio" || m.brigade_role === "Emergência") && (!m.shift || (!m.shift.toLowerCase().includes('noite') && !m.shift.toLowerCase().includes('noturno') && !m.shift.toLowerCase().includes('3º turno')))).map(m => (
                            <div key={m.id} className="bg-white border border-gray-200 p-2 rounded-lg text-center shadow-sm">
                              <p className="font-bold text-gray-900 text-xs">{m.name}</p>
                              <p className="text-[10px] text-gray-500">{m.sector}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Primeiros Socorros */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="bg-emerald-50 border border-blue-200 p-2 rounded-lg w-full text-center mb-3 shadow-sm">
                          <h4 className="font-bold text-blue-800 text-xs">Primeiros Socorros</h4>
                        </div>
                        <div className="space-y-2 w-full">
                          {brigade.filter(m => m.brigade_role === "Primeiros Socorros" && (!m.shift || (!m.shift.toLowerCase().includes('noite') && !m.shift.toLowerCase().includes('noturno') && !m.shift.toLowerCase().includes('3º turno')))).map(m => (
                            <div key={m.id} className="bg-white border border-gray-200 p-2 rounded-lg text-center shadow-sm">
                              <p className="font-bold text-gray-900 text-xs">{m.name}</p>
                              <p className="text-[10px] text-gray-500">{m.sector}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Abandono de Área */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg w-full text-center mb-3 shadow-sm">
                          <h4 className="font-bold text-emerald-800 text-xs">Abandono de Área</h4>
                        </div>
                        <div className="space-y-2 w-full">
                          {brigade.filter(m => (m.brigade_role === "Abandono de Área" || m.brigade_role === "Evacuação") && (!m.shift || (!m.shift.toLowerCase().includes('noite') && !m.shift.toLowerCase().includes('noturno') && !m.shift.toLowerCase().includes('3º turno')))).map(m => (
                            <div key={m.id} className="bg-white border border-gray-200 p-2 rounded-lg text-center shadow-sm">
                              <p className="font-bold text-gray-900 text-xs">{m.name}</p>
                              <p className="text-[10px] text-gray-500">{m.sector}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Noturno Section */}
                  <div className="flex flex-col items-center w-1/2 px-2">
                    {/* Leader Noturno dynamic box */}
                    {brigade.filter(m => m.brigade_role === "Líder Noturno").length > 0 ? (
                      brigade.filter(m => m.brigade_role === "Líder Noturno").map(leader => (
                        <div key={leader.id} className="bg-indigo-50 border-2 border-indigo-200 p-3 rounded-xl w-48 text-center relative z-10 shadow-sm mb-4">
                          <h3 className="font-bold text-indigo-900 uppercase text-[10px] mb-1">Líder Noturno</h3>
                          <p className="font-bold text-gray-900 text-xs">{leader.name}</p>
                          <p className="text-[10px] text-gray-500">{leader.sector}</p>
                        </div>
                      ))
                    ) : (
                      <div className="bg-indigo-50 border-2 border-indigo-200 p-3 rounded-xl w-48 text-center relative z-10 shadow-sm mb-4">
                        <h3 className="font-bold text-indigo-900 uppercase text-sm">Líder Noturno</h3>
                        <p className="text-gray-400 text-xs italic">Não definido</p>
                      </div>
                    )}

                    {/* Vertical Line from Noturno Leader */}
                    <div className="w-0.5 h-6 bg-gray-300"></div>

                    {/* Horizontal Line for Noturno Teams */}
                    <div className="w-full h-0.5 bg-gray-300 relative">
                      <div className="absolute left-[16.66%] top-0 w-0.5 h-6 bg-gray-300 -translate-x-1/2"></div>
                      <div className="absolute left-1/2 top-0 w-0.5 h-6 bg-gray-300 -translate-x-1/2"></div>
                      <div className="absolute right-[16.66%] top-0 w-0.5 h-6 bg-gray-300 translate-x-1/2"></div>
                    </div>

                    {/* Noturno Teams */}
                    <div className="flex justify-between w-full mt-6 gap-2">
                      {/* Combate a Incêndio */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="bg-orange-50 border border-orange-200 p-2 rounded-lg w-full text-center mb-3 shadow-sm">
                          <h4 className="font-bold text-orange-800 text-xs">Combate a Incêndio</h4>
                        </div>
                        <div className="space-y-2 w-full">
                          {brigade.filter(m => (m.brigade_role === "Combate a Incêndio" || m.brigade_role === "Emergência") && (m.shift && (m.shift.toLowerCase().includes('noite') || m.shift.toLowerCase().includes('noturno') || m.shift.toLowerCase().includes('3º turno')))).map(m => (
                            <div key={m.id} className="bg-white border border-gray-200 p-2 rounded-lg text-center shadow-sm">
                              <p className="font-bold text-gray-900 text-xs">{m.name}</p>
                              <p className="text-[10px] text-gray-500">{m.sector}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Primeiros Socorros */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="bg-emerald-50 border border-blue-200 p-2 rounded-lg w-full text-center mb-3 shadow-sm">
                          <h4 className="font-bold text-blue-800 text-xs">Primeiros Socorros</h4>
                        </div>
                        <div className="space-y-2 w-full">
                          {brigade.filter(m => m.brigade_role === "Primeiros Socorros" && (m.shift && (m.shift.toLowerCase().includes('noite') || m.shift.toLowerCase().includes('noturno') || m.shift.toLowerCase().includes('3º turno')))).map(m => (
                            <div key={m.id} className="bg-white border border-gray-200 p-2 rounded-lg text-center shadow-sm">
                              <p className="font-bold text-gray-900 text-xs">{m.name}</p>
                              <p className="text-[10px] text-gray-500">{m.sector}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Abandono de Área */}
                      <div className="flex flex-col items-center w-1/3">
                        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg w-full text-center mb-3 shadow-sm">
                          <h4 className="font-bold text-emerald-800 text-xs">Abandono de Área</h4>
                        </div>
                        <div className="space-y-2 w-full">
                          {brigade.filter(m => (m.brigade_role === "Abandono de Área" || m.brigade_role === "Evacuação") && (m.shift && (m.shift.toLowerCase().includes('noite') || m.shift.toLowerCase().includes('noturno') || m.shift.toLowerCase().includes('3º turno')))).map(m => (
                            <div key={m.id} className="bg-white border border-gray-200 p-2 rounded-lg text-center shadow-sm">
                              <p className="font-bold text-gray-900 text-xs">{m.name}</p>
                              <p className="text-[10px] text-gray-500">{m.sector}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brigade.map(member => (
              <div key={member.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-start gap-4">
                <img 
                  src={member.photo_url || "https://picsum.photos/seed/user/100/100"} 
                  alt={member.name} 
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-red-500 p-0.5"
                />
                <div>
                  <h3 className="font-bold text-gray-900">{member.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">{member.role} • {member.sector}</p>
                  <span className={clsx(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                    (member.brigade_role === "Combate a Incêndio" || member.brigade_role === "Emergência") ? "bg-red-100 text-red-800" :
                    member.brigade_role === "Primeiros Socorros" ? "bg-emerald-100 text-blue-800" :
                    member.brigade_role.includes("Líder") ? "bg-purple-100 text-purple-800" :
                    "bg-orange-100 text-orange-800"
                  )}>
                    {member.brigade_role}
                  </span>
                  <p className="text-xs text-gray-400 mt-2">Turno: {member.shift}</p>
                </div>
              </div>
            ))}
            {brigade.length === 0 && (
              <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
                Nenhum brigadista cadastrado.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Equipment Summary Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            Equipamentos de Combate a Incêndio
          </h2>
          {canEditPage && (
            <button onClick={() => setShowEquipmentModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />
              <span>Adicionar Equipamento</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(equipment.reduce((acc: any, eq) => {
            const sector = eq.sector || "Sem Setor";
            if (!acc[sector]) acc[sector] = { extintores: 0, hidrantes: 0, mangueiras: 0, botoeiras: 0, alarmes: 0, sirenes: 0, items: [] };
            
            const type = eq.type?.toLowerCase() || "";
            const qty = eq.quantity || 1;
            
            if (type.includes("extintor")) acc[sector].extintores += qty;
            else if (type.includes("hidrante")) acc[sector].hidrantes += qty;
            else if (type.includes("mangueira")) acc[sector].mangueiras += qty;
            else if (type.includes("botoeira")) acc[sector].botoeiras += qty;
            else if (type.includes("alarme")) acc[sector].alarmes += qty;
            else if (type.includes("sirene")) acc[sector].sirenes += qty;
            
            acc[sector].items.push(eq);
            return acc;
          }, {} as Record<string, any>)).map(([sector, data]: [string, any], index) => {
            const colors = ["bg-red-50 border-red-200", "bg-emerald-50 border-blue-200", "bg-emerald-50 border-emerald-200", "bg-orange-50 border-orange-200", "bg-purple-50 border-purple-200"];
            const colorClass = colors[index % colors.length];
            
            return (
              <div key={sector} className={`p-6 rounded-xl shadow-sm border ${colorClass}`}>
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-black/10 pb-2">{sector}</h3>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center bg-white/60 p-2 rounded-lg">
                    <span className="block text-2xl font-bold text-red-600">{data.extintores}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase">Extintores</span>
                  </div>
                  <div className="text-center bg-white/60 p-2 rounded-lg">
                    <span className="block text-2xl font-bold text-emerald-600">{data.hidrantes}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase">Hidrantes</span>
                  </div>
                  <div className="text-center bg-white/60 p-2 rounded-lg">
                    <span className="block text-2xl font-bold text-emerald-600">{data.mangueiras}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase">Mangueiras</span>
                  </div>
                  <div className="text-center bg-white/60 p-2 rounded-lg">
                    <span className="block text-2xl font-bold text-orange-600">{data.botoeiras}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase">Botoeiras</span>
                  </div>
                  <div className="text-center bg-white/60 p-2 rounded-lg">
                    <span className="block text-2xl font-bold text-purple-600">{data.alarmes}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase">Alarmes</span>
                  </div>
                  <div className="text-center bg-white/60 p-2 rounded-lg">
                    <span className="block text-2xl font-bold text-yellow-600">{data.sirenes}</span>
                    <span className="text-xs font-medium text-gray-600 uppercase">Sirenes</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Localizações</h4>
                  {data.items.map((eq: any) => (
                    <div key={eq.id} className="text-sm bg-white/80 p-2 rounded border border-black/5 flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-900">{eq.equipment_number ? `#${eq.equipment_number} ` : ''}{eq.type}</span>
                        <span className="text-gray-500 block text-xs">{eq.location}</span>
                      </div>
                      <span className="text-xs font-bold bg-black/5 px-2 py-1 rounded">Qtd: {eq.quantity || 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {equipment.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
              Nenhum equipamento registrado.
            </div>
          )}
        </div>
      </section>

      {/* Inspections Report Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-orange-600" />
            Relatório de Inspeções de Incêndio (NR-23/CBMRS)
          </h2>
        </div>

        {/* Inspections Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Inspecionados Hoje</p>
            <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Nesta Semana</p>
            <p className="text-2xl font-bold text-gray-900">{stats.thisWeek}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Neste Mês</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
              <span className={clsx(
                "flex items-center text-xs font-medium mb-1",
                monthGrowth > 0 ? "text-emerald-600" : monthGrowth < 0 ? "text-red-600" : "text-gray-500"
              )}>
                {monthGrowth > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : monthGrowth < 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
                {Math.abs(monthGrowth)}% vs mês ant.
              </span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">Neste Ano</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-gray-900">{stats.thisYear}</p>
              <span className={clsx(
                "flex items-center text-xs font-medium mb-1",
                yearGrowth > 0 ? "text-emerald-600" : yearGrowth < 0 ? "text-red-600" : "text-gray-500"
              )}>
                {yearGrowth > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : yearGrowth < 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
                {Math.abs(yearGrowth)}% vs ano ant.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-orange-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              Resultados das Inspeções
            </h3>
            <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full">
              Total: {inspections.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Setor</th>
                  <th className="p-3 font-medium">Equipamento</th>
                  <th className="p-3 font-medium">Condição</th>
                  <th className="p-3 font-medium">Sinalização</th>
                  <th className="p-3 font-medium">Desobstruído</th>
                  <th className="p-3 font-medium">Defeitos / Observações</th>
                  <th className="p-3 font-medium text-center">Fotos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {inspections.map(insp => (
                  <tr key={insp.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-medium text-gray-900">{format(new Date(insp.date), "dd/MM/yyyy HH:mm")}</td>
                    <td className="p-3 text-gray-700">{insp.sector}</td>
                    <td className="p-3 font-medium">{insp.equipment_type}</td>
                    <td className="p-3">
                      <span className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        insp.equipment_condition === "Conforme" ? "bg-emerald-100 text-emerald-800" : 
                        insp.equipment_condition === "Não Conforme" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                      )}>
                        {insp.equipment_condition}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        insp.signaling === "Conforme" ? "bg-emerald-100 text-emerald-800" : 
                        insp.signaling === "Não Conforme" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                      )}>
                        {insp.signaling}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        insp.unobstructed === "Conforme" ? "bg-emerald-100 text-emerald-800" : 
                        insp.unobstructed === "Não Conforme" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                      )}>
                        {insp.unobstructed}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700 max-w-xs truncate" title={insp.observations}>
                      {insp.observations || "-"}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {insp.photo_location && (
                          <a href={insp.photo_location} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-blue-800" title="Foto do Local">
                            <Camera className="w-4 h-4" />
                          </a>
                        )}
                        {insp.photo_nonconformity && (
                          <a href={insp.photo_nonconformity} target="_blank" rel="noreferrer" className="text-red-600 hover:text-red-800" title="Foto da Não Conformidade">
                            <AlertTriangle className="w-4 h-4" />
                          </a>
                        )}
                        {!insp.photo_location && !insp.photo_nonconformity && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {inspections.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500">
                      Nenhuma inspeção de incêndio registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Hydrant Tests Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Droplet className="w-6 h-6 text-blue-600" />
            Testes de Hidrante
          </h2>
          {canEditPage && (
            <button onClick={() => setShowHydrantTestModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />
              <span>Registrar Teste de Hidrante</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Hidrante</th>
                  <th className="p-4 font-medium">Localização</th>
                  <th className="p-4 font-medium">Participantes</th>
                  <th className="p-4 font-medium text-center">Relatório</th>
                  {canEditPage && <th className="p-4 font-medium text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {hydrantTests.map(test => (
                  <tr key={test.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium text-gray-900">{format(parseISO(test.test_date), "dd/MM/yyyy")}</td>
                    <td className="p-4 font-medium">{test.hydrant_name}</td>
                    <td className="p-4 text-gray-700">{test.location}</td>
                    <td className="p-4 text-gray-600">
                      {test.participants && test.participants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {test.participants.map(p => (
                            <span key={p} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{p}</span>
                          ))}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => generateHydrantTestPDF(test)}
                        className="text-blue-600 hover:text-blue-800 p-1 inline-flex items-center gap-1"
                        title="Gerar Relatório PDF"
                      >
                        <FileText className="w-4 h-4" /> PDF
                      </button>
                    </td>
                    {canEditPage && (
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteHydrantTest(test.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {hydrantTests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Nenhum teste de hidrante registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Brigade Trainings Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Flame className="w-6 h-6 text-red-600" />
            Calendário Curso Brigada
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Tipo</th>
                  <th className="p-4 font-medium">Horário</th>
                  <th className="p-4 font-medium">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {brigadeTrainings.map(training => (
                  <tr key={training.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium text-gray-900">{format(parseISO(training.date), "dd/MM/yyyy")}</td>
                    <td className="p-4 text-gray-700">{training.type}</td>
                    <td className="p-4 text-gray-700">{training.start_time} às {training.end_time}</td>
                    <td className="p-4 text-gray-700">{training.observations || '-'}</td>
                  </tr>
                ))}
                {brigadeTrainings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      Nenhum curso agendado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Evacuation Drills Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            Relatórios de Simulados
          </h2>
          {canEditPage && (
            <button onClick={() => setShowDrillModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />
              <span>Registrar Simulado</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="p-4 font-medium">Seq.</th>
                  <th className="p-4 font-medium">Tipo</th>
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Localização</th>
                  <th className="p-4 font-medium">Turno</th>
                  <th className="p-4 font-medium">Duração</th>
                  <th className="p-4 font-medium text-center">Relatório</th>
                  {canEditPage && <th className="p-4 font-medium text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {evacuationDrills.map(drill => (
                  <tr key={drill.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium text-gray-900">#{drill.id.toString().padStart(4, '0')}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold uppercase">
                        {drill.drill_type || "Abandono"}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{format(parseISO(drill.date), "dd/MM/yyyy")}</td>
                    <td className="p-4 text-gray-700">{drill.location}</td>
                    <td className="p-4 text-gray-700">{drill.shift}</td>
                    <td className="p-4 text-gray-700">{drill.total_duration}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => generateDrillPDF(drill)}
                          className="text-emerald-600 hover:text-emerald-800 p-1 inline-flex items-center gap-1"
                          title="Gerar Relatório PDF"
                        >
                          <FileText className="w-4 h-4" /> PDF
                        </button>
                        <button 
                          onClick={() => handleOpenOrganogramModal(drill)}
                          className="text-blue-600 hover:text-blue-800 p-1 inline-flex items-center gap-1"
                          title="Definir Funções do Simulado"
                        >
                          <Users className="w-4 h-4" /> Funções
                        </button>
                      </div>
                    </td>
                    {canEditPage && (
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteDrill(drill.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {evacuationDrills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      Nenhum simulado registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Evacuation Tests Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            Testes de Evacuação (2x/ano)
          </h2>
          {canEditPage && (
            <button onClick={() => setShowTestModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />
              <span>Registrar Teste</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="p-4 font-medium">Data do Teste</th>
                  <th className="p-4 font-medium">Próximo Teste</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Observações</th>
                  <th className="p-4 font-medium">Anexo/Foto</th>
                  {canEditPage && <th className="p-4 font-medium text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {evacuationTests.map(test => (
                  <tr key={test.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium text-gray-900">{format(new Date(test.date), "dd/MM/yyyy")}</td>
                    <td className="p-4 text-gray-700">{format(new Date(test.next_test), "dd/MM/yyyy")}</td>
                    <td className="p-4">
                      <span className={clsx(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                        test.status.includes("Sucesso") ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      )}>
                        {test.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 max-w-xs truncate" title={test.observations}>{test.observations || "-"}</td>
                    <td className="p-4">
                      {test.photo_url ? (
                        <a href={test.photo_url} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1">
                          <Camera className="w-4 h-4" /> Ver
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {canEditPage && (
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeleteTest(test.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {evacuationTests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Nenhum teste de evacuação registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Evacuation Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Registrar Teste de Evacuação</h2>
              <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleTestSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data do Teste</label>
                    <input type="date" name="date" value={testData.date || ""} onChange={handleTestChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Próximo Teste (Recomendado 6 meses)</label>
                    <input type="date" name="next_test" value={testData.next_test || ""} onChange={handleTestChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status / Resultado</label>
                    <select name="status" value={testData.status} onChange={handleTestChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                      <option value="Realizado com Sucesso">Realizado com Sucesso</option>
                      <option value="Realizado com Falhas">Realizado com Falhas</option>
                      <option value="Não Realizado">Não Realizado</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Tempo de evacuação, falhas, etc)</label>
                    <textarea name="observations" value={testData.observations || ""} onChange={handleTestChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Descreva os detalhes do teste..."></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <ImageUpload
                      label="Anexar Foto / Relatório"
                      name="photo_url"
                      currentImage={testData.photo_url}
                      onImageSelect={handleFileChange}
                      accept="image/*,.pdf"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowTestModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Salvar Teste</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evacuation Drill Modal */}
      {showDrillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Registrar Simulado</h2>
              <button onClick={() => setShowDrillModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleDrillSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Simulado</label>
                    <select 
                      name="drill_type" 
                      value={drillData.drill_type || "Abandono de Área"} 
                      onChange={handleDrillChange} 
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                      required
                    >
                      <option value="Abandono de Área">Abandono de Área</option>
                      <option value="Incêndio">Simulados de Incêndio: Procedimentos em caso de incêndio</option>
                      <option value="Vazamento Químico">Simulados de Vazamento Químico: Resposta a derramamentos ou vazamentos de substâncias perigosas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <input type="date" name="date" value={drillData.date || ""} onChange={handleDrillChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário Inicial</label>
                    <input type="time" name="start_time" value={drillData.start_time || ""} onChange={handleDrillChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário Término</label>
                    <input type="text" name="end_time" value={drillData.end_time || ""} onChange={handleDrillChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 16:40 min e 30 segundos" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duração Total</label>
                    <input type="text" name="total_duration" value={drillData.total_duration || ""} onChange={handleDrillChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 00:10:30 segundos" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                    <input type="text" name="shift" value={drillData.shift || ""} onChange={handleDrillChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Dia" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Local da Ocorrência</label>
                    <input type="text" name="location" value={drillData.location || ""} onChange={handleDrillChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Setor trançadeiras" required />
                  </div>
                  
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição da Simulação</label>
                    <textarea name="simulation_description" value={drillData.simulation_description || ""} onChange={handleDrillChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Descreva como ocorreu o princípio de incêndio e o acionamento do alarme..." required></textarea>
                  </div>
                  
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Atendimento a Emergência</label>
                    <textarea name="emergency_response" value={drillData.emergency_response || ""} onChange={handleDrillChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Descreva as ações da brigada, evacuação, primeiros socorros..." required></textarea>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pontos Fortes do Atendimento</label>
                    <textarea name="strong_points" value={drillData.strong_points || ""} onChange={handleDrillChange} rows={2} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Balizamento ágil, comunicação rápida..." required></textarea>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pontos a Melhorar</label>
                    <textarea name="improvement_points" value={drillData.improvement_points || ""} onChange={handleDrillChange} rows={2} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Melhorar o tempo de abandono de área..." required></textarea>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brigadistas Envolvidos</label>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                      {brigade.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {brigade.map(member => (
                            <label key={member.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-100 rounded">
                              <input 
                                type="checkbox" 
                                checked={(drillData.brigade_members || []).includes(member.name)}
                                onChange={() => handleDrillParticipantToggle(member.name)}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-gray-700 truncate" title={member.name}>{member.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Nenhum brigadista cadastrado. Cadastre brigadistas primeiro.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowDrillModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Salvar Relatório</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hydrant Test Modal */}
      {showHydrantTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Droplet className="w-6 h-6 text-blue-600" />
                Registrar Teste de Hidrante
              </h2>
              <button onClick={() => setShowHydrantTestModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleHydrantTestSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data do Teste</label>
                    <input type="date" name="test_date" value={hydrantTestData.test_date || ""} onChange={handleHydrantTestChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificação do Hidrante</label>
                    <input type="text" name="hydrant_name" value={hydrantTestData.hydrant_name || ""} onChange={handleHydrantTestChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: HID-01" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
                    <input type="text" name="location" value={hydrantTestData.location || ""} onChange={handleHydrantTestChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Próximo à portaria principal" required />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brigadistas / Participantes</label>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                      {brigade.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {brigade.map(member => (
                            <label key={member.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-100 rounded">
                              <input 
                                type="checkbox" 
                                checked={(hydrantTestData.participants || []).includes(member.name)}
                                onChange={() => handleHydrantParticipantToggle(member.name)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 truncate" title={member.name}>{member.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Nenhum brigadista cadastrado. Cadastre brigadistas primeiro.</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Itens Verificados</label>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="check_hydrant" checked={hydrantTestData.check_hydrant || false} onChange={handleHydrantTestChange} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-800">Hidrante em boas condições e pressurizado</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="check_hoses" checked={hydrantTestData.check_hoses || false} onChange={handleHydrantTestChange} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-800">Mangueiras inspecionadas e conectadas</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="check_storz_key" checked={hydrantTestData.check_storz_key || false} onChange={handleHydrantTestChange} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-800">Chave Storz presente no abrigo</span>
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações Adicionais</label>
                    <textarea name="observations" value={hydrantTestData.observations || ""} onChange={handleHydrantTestChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Descreva detalhes do teste, pressão da água, problemas encontrados..."></textarea>
                  </div>
                  
                  <div className="md:col-span-2">
                    <ImageUpload
                      label="Registro Fotográfico do Teste"
                      name="photo_url"
                      currentImage={hydrantTestData.photo_url}
                      onImageSelect={handleHydrantFileChange}
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowHydrantTestModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Salvar Teste</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Equipment Modal */}
      {showEquipmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Adicionar Equipamento</h2>
              <button onClick={() => setShowEquipmentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleEquipmentSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Equipamento</label>
                    <select name="type" value={equipmentData.type} onChange={handleEquipmentChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required>
                      {EQUIPMENT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Equipamento</label>
                    <input type="text" name="equipment_number" value={equipmentData.equipment_number} onChange={handleEquipmentChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 01, EXT-01" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                    <SelectWithNew
                      name="sector"
                      value={equipmentData.sector || ""}
                      onChange={handleEquipmentChange}
                      options={sectors}
                      placeholder="Selecione um setor"
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localização Específica</label>
                    <input type="text" name="location" value={equipmentData.location} onChange={handleEquipmentChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required placeholder="Ex: Próximo à porta principal" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input type="number" name="quantity" value={equipmentData.quantity} onChange={handleEquipmentChange} min="1" className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" value={equipmentData.status} onChange={handleEquipmentChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Em Manutenção">Em Manutenção</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Inspeção</label>
                    <input type="date" name="next_inspection" value={equipmentData.next_inspection} onChange={handleEquipmentChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teste Hidrostático (se aplicável)</label>
                    <input type="date" name="hydrostatic_test" value={equipmentData.hydrostatic_test} onChange={handleEquipmentChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUpload
                      label="Foto do Equipamento (Opcional)"
                      name="photo_url"
                      currentImage={equipmentData.photo_url}
                      onImageSelect={handleEquipmentFileChange}
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowEquipmentModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Salvar Equipamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showOrganogramModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Funções dos Brigadistas - Simulado</h2>
              <button onClick={() => setShowOrganogramModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1. Ligação</label>
                  <input type="text" value={organogramData.role1_call} onChange={e => setOrganogramData({...organogramData, role1_call: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">2. Sentir cheiro de queimado</label>
                  <input type="text" value={organogramData.role2_smell} onChange={e => setOrganogramData({...organogramData, role2_smell: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">3. Combater princípio de incêndio (CO2)</label>
                  <input type="text" value={organogramData.role3_fight_initial} onChange={e => setOrganogramData({...organogramData, role3_fight_initial: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">4. Acionar botoeira de incêndio</label>
                  <input type="text" value={organogramData.role4_alarm} onChange={e => setOrganogramData({...organogramData, role4_alarm: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">5. Informar local e ligar para bombeiros</label>
                  <input type="text" value={organogramData.role5_inform_firefighters} onChange={e => setOrganogramData({...organogramData, role5_inform_firefighters: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">6. Combater o incêndio (Equipe)</label>
                <div className="space-y-2">
                  {organogramData.role6_fight_fire.map((name, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={name} onChange={e => {
                        const newArr = [...organogramData.role6_fight_fire];
                        newArr[idx] = e.target.value;
                        setOrganogramData({...organogramData, role6_fight_fire: newArr});
                      }} className="flex-1 p-2 border border-gray-300 rounded-lg" placeholder="Nome" />
                      <button onClick={() => {
                        const newArr = organogramData.role6_fight_fire.filter((_, i) => i !== idx);
                        setOrganogramData({...organogramData, role6_fight_fire: newArr});
                      }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setOrganogramData({...organogramData, role6_fight_fire: [...organogramData.role6_fight_fire, ""]})} className="text-sm text-emerald-600 font-medium">+ Adicionar Pessoa</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">7. Realizar evacuação nos banheiros, salas, setores e administrativo</label>
                <div className="space-y-2">
                  {organogramData.role7_evacuation.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={item.name} onChange={e => {
                        const newArr = [...organogramData.role7_evacuation];
                        newArr[idx].name = e.target.value;
                        setOrganogramData({...organogramData, role7_evacuation: newArr});
                      }} className="w-1/3 p-2 border border-gray-300 rounded-lg" placeholder="Nome" />
                      <input type="text" value={item.area} onChange={e => {
                        const newArr = [...organogramData.role7_evacuation];
                        newArr[idx].area = e.target.value;
                        setOrganogramData({...organogramData, role7_evacuation: newArr});
                      }} className="flex-1 p-2 border border-gray-300 rounded-lg" placeholder="Área/Setor" />
                      <button onClick={() => {
                        const newArr = organogramData.role7_evacuation.filter((_, i) => i !== idx);
                        setOrganogramData({...organogramData, role7_evacuation: newArr});
                      }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setOrganogramData({...organogramData, role7_evacuation: [...organogramData.role7_evacuation, {name: "", area: ""}]})} className="text-sm text-emerald-600 font-medium">+ Adicionar Setor</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">8. Sinalizar setores orientando até o ponto de encontro</label>
                <div className="space-y-2">
                  {organogramData.role8_signaling_sectors.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={item.name} onChange={e => {
                        const newArr = [...organogramData.role8_signaling_sectors];
                        newArr[idx].name = e.target.value;
                        setOrganogramData({...organogramData, role8_signaling_sectors: newArr});
                      }} className="w-1/3 p-2 border border-gray-300 rounded-lg" placeholder="Nome" />
                      <input type="text" value={item.area} onChange={e => {
                        const newArr = [...organogramData.role8_signaling_sectors];
                        newArr[idx].area = e.target.value;
                        setOrganogramData({...organogramData, role8_signaling_sectors: newArr});
                      }} className="flex-1 p-2 border border-gray-300 rounded-lg" placeholder="Área/Setor" />
                      <button onClick={() => {
                        const newArr = organogramData.role8_signaling_sectors.filter((_, i) => i !== idx);
                        setOrganogramData({...organogramData, role8_signaling_sectors: newArr});
                      }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setOrganogramData({...organogramData, role8_signaling_sectors: [...organogramData.role8_signaling_sectors, {name: "", area: ""}]})} className="text-sm text-emerald-600 font-medium">+ Adicionar Setor</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">9. Simulando desligamento da energia geral</label>
                  <input type="text" value={organogramData.role9_power_shutdown} onChange={e => setOrganogramData({...organogramData, role9_power_shutdown: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">11. Sinalizando no portão com 2 cones</label>
                  <input type="text" value={organogramData.role11_signaling_gate} onChange={e => setOrganogramData({...organogramData, role11_signaling_gate: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">12. Palavra final</label>
                  <input type="text" value={organogramData.role12_final_word} onChange={e => setOrganogramData({...organogramData, role12_final_word: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Nome" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">10. Sinalização no ponto de encontro</label>
                <div className="space-y-2">
                  {organogramData.role10_signaling_meeting_point.map((name, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={name} onChange={e => {
                        const newArr = [...organogramData.role10_signaling_meeting_point];
                        newArr[idx] = e.target.value;
                        setOrganogramData({...organogramData, role10_signaling_meeting_point: newArr});
                      }} className="flex-1 p-2 border border-gray-300 rounded-lg" placeholder="Nome" />
                      <button onClick={() => {
                        const newArr = organogramData.role10_signaling_meeting_point.filter((_, i) => i !== idx);
                        setOrganogramData({...organogramData, role10_signaling_meeting_point: newArr});
                      }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setOrganogramData({...organogramData, role10_signaling_meeting_point: [...organogramData.role10_signaling_meeting_point, ""]})} className="text-sm text-emerald-600 font-medium">+ Adicionar Pessoa</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Extras: Ajudar pessoas específicas (ex: Grávidas)</label>
                <div className="space-y-2">
                  {organogramData.extras_help.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={item.person_helped} onChange={e => {
                        const newArr = [...organogramData.extras_help];
                        newArr[idx].person_helped = e.target.value;
                        setOrganogramData({...organogramData, extras_help: newArr});
                      }} className="w-1/3 p-2 border border-gray-300 rounded-lg" placeholder="Pessoa a ser ajudada" />
                      <input type="text" value={item.helper} onChange={e => {
                        const newArr = [...organogramData.extras_help];
                        newArr[idx].helper = e.target.value;
                        setOrganogramData({...organogramData, extras_help: newArr});
                      }} className="flex-1 p-2 border border-gray-300 rounded-lg" placeholder="Ajudante(s)" />
                      <button onClick={() => {
                        const newArr = organogramData.extras_help.filter((_, i) => i !== idx);
                        setOrganogramData({...organogramData, extras_help: newArr});
                      }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setOrganogramData({...organogramData, extras_help: [...organogramData.extras_help, {helper: "", person_helped: ""}]})} className="text-sm text-emerald-600 font-medium">+ Adicionar Ajuda</button>
                </div>
              </div>

            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button 
                type="button" 
                onClick={() => setShowOrganogramModal(false)} 
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={() => {
                  if (selectedDrillForOrganogram) {
                    generateOrganogramPDF(selectedDrillForOrganogram);
                  }
                }} 
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Imprimir PDF
              </button>
              <button 
                type="button" 
                onClick={handleSaveOrganogram} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Salvar Funções
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brigade Management Modal */}
      {showBrigadeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Gerenciar Membros da Brigada</h2>
              <button onClick={() => setShowBrigadeModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Add New Member Form */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">Adicionar Novo Membro</h3>
                <form onSubmit={handleBrigadeSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                    <select 
                      value={newBrigadeMember.employee_id}
                      onChange={(e) => setNewBrigadeMember({...newBrigadeMember, employee_id: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                      required
                    >
                      <option value="">Selecione um funcionário...</option>
                      {allEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.sector})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Função na Brigada</label>
                    <select 
                      value={newBrigadeMember.brigade_role}
                      onChange={(e) => setNewBrigadeMember({...newBrigadeMember, brigade_role: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                      required
                    >
                      <option value="Combate a Incêndio">Combate a Incêndio</option>
                      <option value="Primeiros Socorros">Primeiros Socorros</option>
                      <option value="Abandono de Área">Abandono de Área</option>
                      <option value="Líder Diurno">Líder Diurno</option>
                      <option value="Líder Noturno">Líder Noturno</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium h-[38px] flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Adicionar à Brigada
                  </button>
                </form>
              </div>

              {/* Current Members List */}
              <div>
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">Membros Atuais da Brigada</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-600 uppercase tracking-tighter">
                        <th className="p-3 font-medium">Nome</th>
                        <th className="p-3 font-medium">Setor</th>
                        <th className="p-3 font-medium">Função</th>
                        <th className="p-3 font-medium text-right pr-6">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs">
                      {brigade.length > 0 ? brigade.map(member => (
                        <tr key={member.id} className="hover:bg-gray-50/80 transition">
                          <td className="p-3 font-semibold text-gray-900">{member.name}</td>
                          <td className="p-3 text-gray-600">{member.sector}</td>
                          <td className="p-3">
                            <span className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              member.brigade_role?.includes("Líder") ? "bg-purple-100 text-purple-700" :
                              (member.brigade_role?.includes("Combate") || member.brigade_role?.includes("Emergência")) ? "bg-orange-100 text-orange-700" :
                              member.brigade_role?.includes("Socorros") ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {member.brigade_role}
                            </span>
                          </td>
                          <td className="p-3 text-right pr-6">
                            <button 
                              onClick={() => handleDeleteBrigadeMember(member.id)} 
                              className="text-red-400 hover:text-red-700 transition p-1 hover:bg-red-50 rounded"
                              title="Remover da Brigada"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="p-10 text-center text-gray-500 italic">Nenhum membro cadastrado na brigada através desta ferramenta.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 text-right shrink-0">
               <button onClick={() => setShowBrigadeModal(false)} className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium">
                  Fechar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
