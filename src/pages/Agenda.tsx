import { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Clock, MapPin, Users, Plus, Droplet, X, ChevronDown, ShieldAlert, Activity, FileText, Flame } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, parseISO, isValid, addMonths } from "date-fns";
import { ImageUpload } from "../components/ImageUpload";
import { clsx } from "clsx";

interface AgendaEvent {
  id: string;
  title: string;
  date: Date;
  type: 'Treinamento' | 'Inspeção' | 'Vencimento' | 'Reunião CIPA' | 'Teste de Hidrante' | 'Outro';
  location?: string;
  participants?: string;
  time?: string;
  colorClass: string;
  iconClass: string;
}

interface HydrantTest {
  id?: string;
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

export default function Agenda() {
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit && !isMobile;

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [filters, setFilters] = useState({
    treinamentos: true,
    inspecoes: true,
    vencimentos: true,
    cipa: true,
    hidrantes: true,
    outros: true
  });

  // Hydrant Modal State
  const [showHydrantModal, setShowHydrantModal] = useState(false);
  const [brigade, setBrigade] = useState<any[]>([]);
  const [hydrantTestData, setHydrantTestData] = useState<HydrantTest>({
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

  // New Event Modals State
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [trainingData, setTrainingData] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    instructor: "",
    enrolled: 0,
    workload: 0,
    validity_months: 12
  });

  const [showCipaModal, setShowCipaModal] = useState(false);
  const [cipaData, setCipaData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    type: "Ordinária"
  });

  const [showCustomEventModal, setShowCustomEventModal] = useState(false);
  const [customEventData, setCustomEventData] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "",
    location: "",
    participants: "",
    description: ""
  });

  const [showBrigadeTrainingModal, setShowBrigadeTrainingModal] = useState(false);
  const [brigadeTrainingData, setBrigadeTrainingData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    type: "Formação",
    start_time: "13:00",
    end_time: "15:00",
    observations: ""
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const newEvents: AgendaEvent[] = [];

      // Fetch Brigade for modal
      const { data: brigadeRes } = await supabase.from('brigade_members').select('*, employees(name)');
      if (brigadeRes) {
        setBrigade(brigadeRes.map(b => ({ ...b, name: b.employees?.name })));
      }

      // Fetch Treinamentos
      const { data: trainings } = await supabase.from('trainings').select('*');
      trainings?.forEach(t => {
        if (t.date) {
          newEvents.push({
            id: `tr-${t.id}`,
            title: `Treinamento: ${t.title || t.course_name || 'Sem título'}`,
            date: parseISO(t.date),
            type: 'Treinamento',
            location: t.location || 'Não informado',
            participants: t.participants ? `${t.participants.length} Inscritos` : '',
            colorClass: 'bg-purple-50 text-purple-600',
            iconClass: 'bg-purple-100 text-purple-800'
          });
        }
      });

      // Fetch CIPA
      const { data: cipa } = await supabase.from('cipa_meetings').select('*');
      cipa?.forEach(c => {
        if (c.date) {
          newEvents.push({
            id: `cipa-${c.id}`,
            title: `Reunião CIPA ${c.type || ''}`,
            date: parseISO(c.date),
            type: 'Reunião CIPA',
            location: 'Sala de Reuniões',
            time: 'A definir',
            colorClass: 'bg-emerald-50 text-emerald-600',
            iconClass: 'bg-emerald-100 text-emerald-800'
          });
        }
      });

      // Fetch Custom Agenda Events
      const { data: customEvents } = await supabase.from('agenda_events').select('*');
      customEvents?.forEach(e => {
        if (e.date) {
          newEvents.push({
            id: `custom-${e.id}`,
            title: e.title,
            date: parseISO(e.date),
            type: 'Outro',
            location: e.location,
            time: e.time,
            participants: e.participants,
            colorClass: 'bg-gray-50 text-gray-600',
            iconClass: 'bg-gray-100 text-gray-800'
          });
        }
      });

      // Fetch Brigade Training Schedules
      const { data: brigadeTrainings } = await supabase.from('brigade_training_schedules').select('*');
      brigadeTrainings?.forEach(bt => {
        if (bt.date) {
          newEvents.push({
            id: `bt-${bt.id}`,
            title: `Curso Brigada: ${bt.type}`,
            date: parseISO(bt.date),
            type: 'Treinamento',
            time: `${bt.start_time} às ${bt.end_time}`,
            colorClass: 'bg-red-50 text-red-600',
            iconClass: 'bg-red-100 text-red-800'
          });
        }
      });

      // Fetch Hydrant Tests
      const { data: hydrants } = await supabase.from('hydrant_tests').select('*');
      hydrants?.forEach(h => {
        if (h.test_date) {
          newEvents.push({
            id: `hyd-${h.id}`,
            title: `Teste de Hidrante: ${h.hydrant_name}`,
            date: parseISO(h.test_date),
            type: 'Teste de Hidrante',
            location: h.location,
            participants: h.participants ? `${h.participants.length} Participantes` : '',
            colorClass: 'bg-blue-50 text-blue-600',
            iconClass: 'bg-blue-100 text-blue-800'
          });
        }
      });

      // Fetch Inspections (Fire)
      const { data: fireInsp } = await supabase.from('inspection_fire').select('*');
      fireInsp?.forEach(i => {
        if (i.date) {
          newEvents.push({
            id: `f-insp-${i.id}`,
            title: `Inspeção de Incêndio: ${i.equipment_type}`,
            date: parseISO(i.date),
            type: 'Inspeção',
            location: i.sector,
            participants: i.inspector,
            colorClass: 'bg-emerald-50 text-emerald-600',
            iconClass: 'bg-emerald-100 text-emerald-800'
          });
        }
      });

      // Fetch Vencimentos (Exams)
      const { data: exams } = await supabase.from('exams').select('*, employees(name)');
      exams?.forEach(e => {
        if (e.next_exam_date) {
          newEvents.push({
            id: `ex-${e.id}`,
            title: `Vencimento Exame: ${e.exam_type} - ${e.employees?.name}`,
            date: parseISO(e.next_exam_date),
            type: 'Vencimento',
            colorClass: 'bg-orange-50 text-orange-600',
            iconClass: 'bg-orange-100 text-orange-800'
          });
        }
      });

      // Fetch Vencimentos (Fire Equipment)
      const { data: eq } = await supabase.from('fire_equipment').select('*');
      eq?.forEach(e => {
        if (e.next_inspection) {
          newEvents.push({
            id: `eq-${e.id}`,
            title: `Vencimento Inspeção: ${e.type} ${e.equipment_number || ''}`,
            date: parseISO(e.next_inspection),
            type: 'Vencimento',
            location: e.location,
            colorClass: 'bg-orange-50 text-orange-600',
            iconClass: 'bg-orange-100 text-orange-800'
          });
        }
      });

      // Sort by date ascending
      newEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Filter out invalid dates
      setEvents(newEvents.filter(e => isValid(e.date)));
    } catch (error) {
      console.error("Error loading agenda events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      
      setShowHydrantModal(false);
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

  const handleTrainingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('trainings').insert([trainingData]);
      if (error) throw error;
      
      setShowTrainingModal(false);
      setTrainingData({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        instructor: "",
        enrolled: 0,
        workload: 0,
        validity_months: 12
      });
      loadData();
    } catch (error) {
      console.error("Error saving training:", error);
      alert("Erro ao salvar treinamento.");
    }
  };

  const handleCipaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('cipa_meetings').insert([cipaData]);
      if (error) throw error;
      
      setShowCipaModal(false);
      setCipaData({
        date: format(new Date(), "yyyy-MM-dd"),
        type: "Ordinária"
      });
      loadData();
    } catch (error) {
      console.error("Error saving CIPA meeting:", error);
      alert("Erro ao salvar reunião CIPA.");
    }
  };

  const handleCustomEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('agenda_events').insert([customEventData]);
      if (error) throw error;
      
      setShowCustomEventModal(false);
      setCustomEventData({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        time: "",
        location: "",
        participants: "",
        description: ""
      });
      loadData();
    } catch (error) {
      console.error("Error saving custom event:", error);
      alert("Erro ao salvar evento.");
    }
  };

  const handleBrigadeTrainingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('brigade_training_schedules').insert([brigadeTrainingData]);
      if (error) throw error;
      
      setShowBrigadeTrainingModal(false);
      setBrigadeTrainingData({
        date: format(new Date(), "yyyy-MM-dd"),
        type: "Formação",
        start_time: "13:00",
        end_time: "15:00",
        observations: ""
      });
      loadData();
    } catch (error) {
      console.error("Error saving brigade training:", error);
      alert("Erro ao salvar curso da brigada.");
    }
  };

  const filteredEvents = events.filter(e => {
    if (e.type === 'Treinamento' && !filters.treinamentos) return false;
    if (e.type === 'Inspeção' && !filters.inspecoes) return false;
    if (e.type === 'Vencimento' && !filters.vencimentos) return false;
    if (e.type === 'Reunião CIPA' && !filters.cipa) return false;
    if (e.type === 'Teste de Hidrante' && !filters.hidrantes) return false;
    if (e.type === 'Outro' && !filters.outros) return false;
    return true;
  });

  const getMonthName = (date: Date) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[date.getMonth()];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <CalendarIcon className="w-8 h-8 text-purple-600" />
          Agenda Integrada SST
        </h1>
        <div className="flex gap-2">
          <button onClick={loadData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition font-medium">
            Atualizar
          </button>
          {canEditPage && (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowDropdown(!showDropdown)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" /> Novo Evento <ChevronDown className="w-4 h-4" />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20">
                  <button onClick={() => { setShowHydrantModal(true); setShowDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 border-b border-gray-50">
                    <Droplet className="w-4 h-4 text-blue-600" /> Teste de Hidrante
                  </button>
                  <button onClick={() => { setShowTrainingModal(true); setShowDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 border-b border-gray-50">
                    <Users className="w-4 h-4 text-emerald-600" /> Treinamento
                  </button>
                  <button onClick={() => { setShowBrigadeTrainingModal(true); setShowDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 border-b border-gray-50">
                    <Flame className="w-4 h-4 text-red-600" /> Curso Brigada
                  </button>
                  <button onClick={() => { setShowCipaModal(true); setShowDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 border-b border-gray-50">
                    <ShieldAlert className="w-4 h-4 text-red-600" /> Reunião CIPA
                  </button>
                  <button onClick={() => { setShowCustomEventModal(true); setShowDropdown(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700">
                    <CalendarIcon className="w-4 h-4 text-gray-600" /> Outro
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[600px]">
          {/* Sidebar */}
          <div className="border-r border-gray-200 p-6 bg-gray-50">
            <h3 className="font-bold text-gray-900 mb-4">Filtros</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.treinamentos} onChange={(e) => setFilters({...filters, treinamentos: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-gray-700">Treinamentos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.inspecoes} onChange={(e) => setFilters({...filters, inspecoes: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-gray-700">Inspeções</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.vencimentos} onChange={(e) => setFilters({...filters, vencimentos: e.target.checked})} className="rounded text-orange-600 focus:ring-orange-500" />
                <span className="text-sm text-gray-700">Vencimentos (EPI/Extintor)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.cipa} onChange={(e) => setFilters({...filters, cipa: e.target.checked})} className="rounded text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-gray-700">Reuniões CIPA</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.hidrantes} onChange={(e) => setFilters({...filters, hidrantes: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Teste de Hidrante</span>
              </label>
            </div>
          </div>

          {/* Main Calendar View */}
          <div className="col-span-3 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Próximos Eventos</h2>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.length > 0 ? filteredEvents.map(event => (
                  <div key={event.id} className="flex gap-4 p-4 border border-gray-100 rounded-xl hover:shadow-md transition bg-white">
                    <div className={clsx("w-16 h-16 rounded-lg flex flex-col items-center justify-center flex-shrink-0", event.colorClass)}>
                      <span className="text-xs font-bold uppercase">{getMonthName(event.date)}</span>
                      <span className="text-2xl font-black">{format(event.date, "dd")}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900 text-lg">{event.title}</h3>
                        <span className={clsx("text-xs font-bold px-2 py-1 rounded", event.iconClass)}>{event.type}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                        {event.time && <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {event.time}</div>}
                        {event.location && <div className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.location}</div>}
                        {event.participants && <div className="flex items-center gap-1"><Users className="w-4 h-4" /> {event.participants}</div>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Nenhum evento encontrado para os filtros selecionados.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hydrant Test Modal (Duplicated from Incendio for convenience) */}
      {showHydrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Droplet className="w-6 h-6 text-blue-600" />
                Registrar Teste de Hidrante
              </h2>
              <button onClick={() => setShowHydrantModal(false)} className="text-gray-400 hover:text-gray-600">
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
                <button type="button" onClick={() => setShowHydrantModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">Salvar Teste</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Training Modal */}
      {showTrainingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600" />
                Agendar Treinamento
              </h2>
              <button onClick={() => setShowTrainingModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleTrainingSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título do Treinamento</label>
                  <input 
                    type="text" 
                    required
                    value={trainingData.title}
                    onChange={e => setTrainingData({...trainingData, title: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                    placeholder="Ex: NR-35 Trabalho em Altura"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    required
                    value={trainingData.date}
                    onChange={e => setTrainingData({...trainingData, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea 
                    required
                    value={trainingData.description}
                    onChange={e => setTrainingData({...trainingData, description: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                    rows={3}
                    placeholder="Detalhes sobre o treinamento..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrutor</label>
                    <input 
                      type="text" 
                      required
                      value={trainingData.instructor}
                      onChange={e => setTrainingData({...trainingData, instructor: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                      placeholder="Nome do instrutor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carga Horária (h)</label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={trainingData.workload}
                      onChange={e => setTrainingData({...trainingData, workload: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50">
                <button type="button" onClick={() => setShowTrainingModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Agendar Treinamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CIPA Meeting Modal */}
      {showCipaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-red-600" />
                Agendar Reunião CIPA
              </h2>
              <button onClick={() => setShowCipaModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCipaSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    required
                    value={cipaData.date}
                    onChange={e => setCipaData({...cipaData, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select 
                    value={cipaData.type}
                    onChange={e => setCipaData({...cipaData, type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                  >
                    <option>Ordinária</option>
                    <option>Extraordinária</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50">
                <button type="button" onClick={() => setShowCipaModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Agendar Reunião</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Event Modal */}
      {showCustomEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-purple-600" />
                Agendar Outro Evento
              </h2>
              <button onClick={() => setShowCustomEventModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCustomEventSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título do Evento</label>
                  <input 
                    type="text" 
                    required
                    value={customEventData.title}
                    onChange={e => setCustomEventData({...customEventData, title: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-400"
                    placeholder="Ex: Reunião com a Diretoria"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <input 
                      type="date" 
                      required
                      value={customEventData.date}
                      onChange={e => setCustomEventData({...customEventData, date: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                    <input 
                      type="time" 
                      value={customEventData.time}
                      onChange={e => setCustomEventData({...customEventData, time: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                  <input 
                    type="text" 
                    value={customEventData.location}
                    onChange={e => setCustomEventData({...customEventData, location: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-400"
                    placeholder="Ex: Sala de Reuniões 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Participantes</label>
                  <input 
                    type="text" 
                    value={customEventData.participants}
                    onChange={e => setCustomEventData({...customEventData, participants: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-400"
                    placeholder="Ex: Diretoria, Gerentes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea 
                    value={customEventData.description}
                    onChange={e => setCustomEventData({...customEventData, description: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-400"
                    rows={3}
                    placeholder="Detalhes adicionais..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50">
                <button type="button" onClick={() => setShowCustomEventModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">Agendar Evento</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBrigadeTrainingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-600" />
                Agendar Curso de Brigada
              </h2>
              <button onClick={() => setShowBrigadeTrainingModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleBrigadeTrainingSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Curso</label>
                  <select 
                    required
                    value={brigadeTrainingData.type}
                    onChange={e => setBrigadeTrainingData({...brigadeTrainingData, type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                  >
                    <option value="Formação">Formação</option>
                    <option value="Reciclagem">Reciclagem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    required
                    value={brigadeTrainingData.date}
                    onChange={e => setBrigadeTrainingData({...brigadeTrainingData, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário Início</label>
                    <input 
                      type="time" 
                      required
                      value={brigadeTrainingData.start_time}
                      onChange={e => setBrigadeTrainingData({...brigadeTrainingData, start_time: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Horário Fim</label>
                    <input 
                      type="time" 
                      required
                      value={brigadeTrainingData.end_time}
                      onChange={e => setBrigadeTrainingData({...brigadeTrainingData, end_time: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
                  <textarea 
                    value={brigadeTrainingData.observations}
                    onChange={e => setBrigadeTrainingData({...brigadeTrainingData, observations: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
                    rows={3}
                    placeholder="Ex: Turma da noite..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50">
                <button type="button" onClick={() => setShowBrigadeTrainingModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Agendar Curso</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
