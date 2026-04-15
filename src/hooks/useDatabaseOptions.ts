import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useDatabaseOptions() {
  const [sectors, setSectors] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([]);
  const [suppliers, setSuppliers] = useState<{id: number, name: string}[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [empRes, supRes] = await Promise.all([
          supabase.from('employees').select('id, name, sector, role, shift').order('name'),
          supabase.from('suppliers').select('id, company_name').order('company_name')
        ]);

        if (empRes.data) {
          setEmployees(empRes.data.map(e => ({ id: e.id, name: e.name })));
          const uniqueSectors = Array.from(new Set(empRes.data.map(e => e.sector).filter(Boolean))) as string[];
          setSectors(uniqueSectors.sort());
          
          const uniqueRoles = Array.from(new Set(empRes.data.map(e => e.role).filter(Boolean))) as string[];
          setRoles(uniqueRoles.sort());
          
          const uniqueShifts = Array.from(new Set(empRes.data.map(e => e.shift).filter(Boolean))) as string[];
          setShifts(uniqueShifts.sort());
        }

        if (supRes.data) {
          setSuppliers(supRes.data.map(s => ({ id: s.id, name: s.company_name })));
        }
      } catch (error) {
        console.error("Error fetching database options:", error);
      }
    };

    fetchOptions();
  }, []);

  return { sectors, roles, shifts, employees, suppliers };
}
