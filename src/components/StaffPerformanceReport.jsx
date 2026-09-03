import React, { useEffect, useMemo, useState, useContext } from 'react';
import { Award, ClipboardCheck, Filter, Pill, Syringe, Users } from 'lucide-react';
import supabase from '../config/supabaseclient';
import { AuthContext } from '../context/AuthContext';
import '../styles/components/StaffPerformanceReport.css';

const EMPTY_METRICS = { visits: 0, vaccinations: 0, supplements: 0, registrations: 0 };

const StaffPerformanceReport = () => {
  const { user } = useContext(AuthContext);
  const role = String(user?.role || '').toLowerCase();
  const canView = role === 'admin' || role === 'cho personnel';
  const [rows, setRows] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stationFilter, setStationFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');

  useEffect(() => {
    if (!canView) return undefined;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      const [staffResult, visitsResult, vaccinationsResult, supplementsResult, patientsResult] = await Promise.all([
        supabase.from('staff_profiles').select('id, full_name, station_ass, stations:station_ass(station_name)').order('full_name'),
        supabase.from('prenatal_visits').select('created_by, status'),
        supabase.from('vaccinations').select('created_by, status'),
        supabase.from('supplements').select('created_by, status'),
        supabase.from('patient_basic_info').select('created_by, station_ass')
      ]);
      const queryError = [staffResult, visitsResult, vaccinationsResult, supplementsResult, patientsResult].find(result => result.error)?.error;
      if (queryError) {
        if (active) setError(queryError.message || 'Unable to load staff performance data.');
        setLoading(false);
        return;
      }

      const staff = staffResult.data || [];
      const stationNames = [...new Set(staff.map(item => item.stations?.station_name).filter(Boolean))].sort();
      const metrics = new Map(staff.map(item => [item.id, {
        id: item.id,
        name: item.full_name || 'Unnamed staff',
        stationId: item.station_ass,
        station: item.stations?.station_name || 'Unassigned',
        ...EMPTY_METRICS
      }]));
      const increment = (record, key) => {
        if (record.created_by && metrics.has(record.created_by)) metrics.get(record.created_by)[key] += 1;
      };
      (visitsResult.data || []).filter(item => item.status === 'Attended').forEach(item => increment(item, 'visits'));
      (vaccinationsResult.data || []).filter(item => item.status === 'Completed').forEach(item => increment(item, 'vaccinations'));
      (supplementsResult.data || []).filter(item => item.status === 'Completed').forEach(item => increment(item, 'supplements'));
      (patientsResult.data || []).forEach(item => increment(item, 'registrations'));

      if (active) {
        setRows([...metrics.values()]);
        setStations(stationNames);
      }
      setLoading(false);
    };

    load().catch(loadError => {
      if (active) setError(loadError.message || 'Unable to load staff performance data.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [canView]);

  const visibleRows = useMemo(() => rows
    .filter(row => stationFilter === 'all' || row.station === stationFilter)
    .filter(row => staffFilter === 'all' || row.id === staffFilter)
    .map(row => ({ ...row, total: row.visits + row.vaccinations + row.supplements + row.registrations }))
    .sort((a, b) => b.total - a.total), [rows, stationFilter, staffFilter]);

  const staffOptions = rows.filter(row => stationFilter === 'all' || row.station === stationFilter);
  const stationScope = stationFilter === 'all' ? 'all stations' : stationFilter;

  if (!canView) return null;

  return (
    <section className="staff-performance-report">
      <div className="staff-performance-header">
        <div>
          <div className="staff-performance-eyebrow"><Award size={15} /> Workforce activity</div>
          <h2>Staff performance</h2>
          <p>Ranked activity from attributed records in {stationScope}.</p>
        </div>
        <div className="staff-performance-filters">
          <label><Filter size={14} /> Station<select value={stationFilter} onChange={event => { setStationFilter(event.target.value); setStaffFilter('all'); }}><option value="all">All stations</option>{stations.map(station => <option key={station} value={station}>{station}</option>)}</select></label>
          <label><Users size={14} /> Staff<select value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="all">All staff</option>{staffOptions.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        </div>
      </div>
      {error && <p className="staff-performance-error">{error}</p>}
      {loading ? <div className="staff-performance-empty">Loading staff activity...</div> : (
        <div className="staff-performance-table-wrap">
          <table className="staff-performance-table">
            <thead><tr><th>Rank</th><th>Staff member</th><th>Station</th><th><ClipboardCheck size={14} /> Visits</th><th><Syringe size={14} /> Vaccinations</th><th><Pill size={14} /> Supplements</th><th><Users size={14} /> Registrations</th><th>Total activity</th></tr></thead>
            <tbody>{visibleRows.map((row, index) => <tr key={row.id}><td><strong className={index < 3 ? 'staff-rank-top' : ''}>#{index + 1}</strong></td><td>{row.name}</td><td>{row.station}</td><td>{row.visits}</td><td>{row.vaccinations}</td><td>{row.supplements}</td><td>{row.registrations}</td><td><strong>{row.total}</strong></td></tr>)}</tbody>
          </table>
          {visibleRows.length === 0 && <div className="staff-performance-empty">No attributed activity matches these filters.</div>}
        </div>
      )}
    </section>
  );
};

export default StaffPerformanceReport;
