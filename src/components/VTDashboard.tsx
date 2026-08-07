"use client";

import React, { useState, useEffect } from 'react';
import { VTCard } from './VTCard';
import { ScheduleVTModal } from './ScheduleVTModal';

interface VT {
  id: string;
  event: string;
  date: string;
  responsible: string;
  companion: string;
  rooms: string[];
  clientRequests: string;
  specialNotes: string;
  status: 'pending' | 'completed';
  notified?: boolean;
}

interface Notification {
  id: string;
  text: string;
  read: boolean;
  createdAt: string;
}

interface BriefingEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function VTDashboard() {
  const [vts, setVts] = useState<VT[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVT, setEditingVT] = useState<VT | null>(null);

  const [availableRooms, setAvailableRooms] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'pending' | 'completed'>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [showRoomDashboard, setShowRoomDashboard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [briefings, setBriefings] = useState<BriefingEmail[]>([]);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  // Carrega os dados iniciais da API
  useEffect(() => {
    (async () => {
      try {
        const [vtsRes, roomsRes, notifsRes, briefsRes] = await Promise.all([
          fetch('/api/vts'),
          fetch('/api/rooms'),
          fetch('/api/notifications'),
          fetch('/api/briefings'),
        ]);
        setVts(await vtsRes.json());
        setAvailableRooms(await roomsRes.json());
        setNotifications(await notifsRes.json());
        setBriefings(await briefsRes.json());
      } catch (e) {
        console.error('Erro ao carregar dados do servidor', e);
        alert('Não foi possível carregar os dados. Verifique sua conexão e recarregue a página.');
      }
    })();
  }, []);

  const handleAddCustomRoom = async (newRoom: string) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoom }),
      });
      if (!response.ok) throw new Error('Falha ao adicionar sala');
      setAvailableRooms(prev => (prev.includes(newRoom) ? prev : [...prev, newRoom]));
    } catch (e) {
      console.error(e);
      alert('Não foi possível adicionar a sala.');
    }
  };

  // Cronómetro de Notificação em Tempo Real (Roda a cada 10 segundos)
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();

      for (const vt of vts) {
        if (vt.notified || vt.status === 'completed' || !vt.date) continue;

        const vtTime = new Date(vt.date).getTime();
        const diffMs = vtTime - now.getTime();

        if (diffMs > 0 && diffMs <= 3 * 60 * 60 * 1000) {
          try {
            const response = await fetch(`/api/vts/${vt.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notified: true }),
            });
            if (!response.ok) throw new Error('Falha ao marcar VT como notificada');
            const updatedVT = await response.json();

            setVts(prev => prev.map(v => (v.id === updatedVT.id ? updatedVT : v)));

            const notifsRes = await fetch('/api/notifications');
            setNotifications(await notifsRes.json());
          } catch (e) {
            console.error(e);
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [vts]);

  // Cálculos das Métricas
  const totalCount = vts.length;

  const todayCount = vts.filter(vt => {
    if (!vt.date) return false;
    const vtDate = new Date(vt.date).toDateString();
    const today = new Date().toDateString();
    return vtDate === today && vt.status !== 'completed';
  }).length;

  const upcomingCount = vts.filter(vt => {
    if (!vt.date) return false;
    const diff = new Date(vt.date).getTime() - new Date().getTime();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000 && vt.status !== 'completed';
  }).length;

  const mappedRoomsCount = new Set(vts.flatMap(vt => vt.rooms || [])).size;

  // Filtragem da Grid
  const filteredVTs = vts.filter(vt => {
    const matchesSearch = (vt.event || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vt.responsible || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vt.companion || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (roomFilter !== 'all' && !(vt.rooms || []).includes(roomFilter)) return false;

    if (!vt.date && statusFilter !== 'all') return false;
    const vtDate = vt.date ? new Date(vt.date).toDateString() : '';
    const today = new Date().toDateString();

    if (statusFilter === 'today') return vtDate === today && vt.status !== 'completed';
    if (statusFilter === 'pending') return vtDate !== today && vt.status === 'pending';
    if (statusFilter === 'completed') return vt.status === 'completed';

    return true;
  });

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  const markAllNotifsRead = async () => {
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH' });
      if (!response.ok) throw new Error('Falha ao marcar notificações como lidas');
      setNotifications(await response.json());
    } catch (e) {
      console.error(e);
      alert('Não foi possível atualizar as notificações.');
    }
  };

  const clearNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao limpar notificações');
      setNotifications([]);
    } catch (e) {
      console.error(e);
      alert('Não foi possível limpar as notificações.');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const response = await fetch(`/api/vts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!response.ok) throw new Error('Falha ao concluir VT');
      const updatedVT = await response.json();
      setVts(prev => prev.map(v => (v.id === updatedVT.id ? updatedVT : v)));
    } catch (e) {
      console.error(e);
      alert('Não foi possível concluir a Visita Técnica.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta Visita Técnica?')) return;
    try {
      const response = await fetch(`/api/vts/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir VT');
      setVts(prev => prev.filter(v => v.id !== id));
    } catch (e) {
      console.error(e);
      alert('Não foi possível excluir a Visita Técnica.');
    }
  };

  const handleSave = async (data: Omit<VT, 'id' | 'status'> & { id?: string }) => {
    try {
      if (data.id) {
        const response = await fetch(`/api/vts/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Falha ao editar VT');
        const updatedVT = await response.json();
        setVts(prev => prev.map(v => (v.id === updatedVT.id ? updatedVT : v)));
      } else {
        const response = await fetch('/api/vts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Falha ao criar VT');
        const newVT = await response.json();
        setVts(prev => [...prev, newVT]);

        const [notifsRes, briefsRes] = await Promise.all([
          fetch('/api/notifications'),
          fetch('/api/briefings'),
        ]);
        setNotifications(await notifsRes.json());
        setBriefings(await briefsRes.json());
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar a Visita Técnica.');
    }
  };

  return (
    <div className="bg-[#090b11] text-white p-6 rounded-2xl border border-[#1d2433] max-w-7xl mx-auto flex flex-col gap-6 relative">
      <header className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-extrabold text-lg tracking-wider">GESTÃO DE VISITAS TÉCNICAS</h2>
          <p className="text-xs text-slate-400">Gerenciamento e registro de solicitações e salas de visitas técnicas da Arena</p>
        </div>

        <div className="flex items-center gap-3 relative">

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsBriefingOpen(false);
              }}
              className="w-10 h-10 rounded-lg border border-[#1d2433] hover:border-slate-600 bg-[#121620] hover:bg-[#1b2130] flex items-center justify-center text-[#9ca3af] hover:text-white transition-all cursor-pointer relative"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ff1a3c] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse border-2 border-[#121620]">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[#121620] border border-[#1d2433] rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] z-[999] overflow-hidden">
                <div className="p-3 border-b border-[#1d2433] flex justify-between items-center bg-[#0e1119]">
                  <span className="font-bold text-xs">Notificações</span>
                  <div className="flex gap-2">
                    <button onClick={markAllNotifsRead} className="text-[9px] text-[#00e5ff] hover:underline">Ler todas</button>
                    <button onClick={clearNotifications} className="text-[9px] text-[#ff1a3c] hover:underline">Limpar</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">Sem novas notificações</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-3 border-b border-[#1d2433]/50 text-xs transition-all hover:bg-white/5 flex flex-col gap-1 ${!n.read ? 'bg-[#ff1a3c]/5 border-l-2 border-l-[#ff1a3c]' : ''}`}
                      >
                        <span className="text-[#f3f4f6]">{n.text}</span>
                        <span className="text-[9px] text-slate-500">{formatTime(n.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsBriefingOpen(true);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-1.5 bg-[#121620] hover:bg-[#1b2130] border border-[#1d2433] hover:border-slate-600 px-4 py-2 rounded-lg text-xs font-semibold text-[#9ca3af] hover:text-white transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">mail</span>
            <span>Briefings Enviados</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingVT(null);
              setIsModalOpen(true);
              setIsNotifOpen(false);
              setIsBriefingOpen(false);
            }}
            className="flex items-center gap-1.5 bg-[#ff1a3c] hover:bg-[#ff4760] px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-[0_4px_14px_rgba(255,26,60,0.35)] hover:-translate-y-0.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Agendar VT</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setStatusFilter('all');
            setRoomFilter('all');
            setShowRoomDashboard(false);
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            statusFilter === 'all' && roomFilter === 'all' && !showRoomDashboard ? 'border-[#ff1a3c]' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">Total de VTs</span>
          <span className="font-extrabold text-2xl font-title">{totalCount}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter('today');
            setRoomFilter('all');
            setShowRoomDashboard(false);
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            statusFilter === 'today' ? 'border-[#ff1a3c]' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">VTs para Hoje</span>
          <span className={`font-extrabold text-2xl font-title ${todayCount > 0 ? 'text-[#ff1a3c]' : ''}`}>{todayCount}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter('pending');
            setRoomFilter('all');
            setShowRoomDashboard(false);
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            statusFilter === 'pending' ? 'border-[#ff1a3c]' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">Próximos Dias</span>
          <span className="font-extrabold text-2xl font-title">{upcomingCount}</span>
        </div>

        <div
          onClick={() => {
            setShowRoomDashboard(!showRoomDashboard);
            setStatusFilter('all');
          }}
          className={`bg-[#121620] border p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 ${
            showRoomDashboard ? 'border-[#00e5ff] bg-[#00e5ff]/5' : 'border-[#1d2433]'
          }`}
        >
          <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-1">Salas Mapeadas</span>
          <span className="font-extrabold text-2xl font-title text-[#00e5ff]">{mappedRoomsCount}</span>
        </div>
      </div>

      {showRoomDashboard && (
        <div className="bg-[#121620] border border-[#1d2433] p-5 rounded-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[#f3f4f6] font-bold text-xs uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#00e5ff]">dashboard</span>
              <span>Espaços Mapeados e VTs Agendadas (O que é cada um)</span>
            </h2>
            <button
              type="button"
              onClick={() => setRoomFilter('all')}
              className="text-[10px] bg-[#1d2433] hover:bg-[#2e3952] px-2.5 py-1 rounded transition-all text-[#9ca3af] hover:text-white cursor-pointer"
            >
              Limpar Filtro de Sala
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(availableRooms || []).map(room => {
              const roomVTs = vts.filter(v => (v.rooms || []).includes(room));
              return (
                <div
                  key={room}
                  onClick={() => setRoomFilter(room)}
                  className={`p-3.5 rounded-lg cursor-pointer border transition-all ${
                    roomFilter === room ? 'border-[#00e5ff] bg-[#00e5ff]/5' : 'border-[#1d2433] bg-[#090b11]/50 hover:border-[#2e3952]'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold text-xs text-[#f3f4f6] mb-2">
                    <span>{room}</span>
                    <span className="bg-[#00e5ff]/10 text-[#00e5ff] px-2 py-0.5 rounded-full text-[10px]">{roomVTs.length}</span>
                  </div>
                  <div className="border-t border-[#1d2433]/60 pt-2 flex flex-col gap-1">
                    {roomVTs.length > 0 ? roomVTs.map(vt => (
                      <div key={vt.id} className="text-[11px] text-[#9ca3af] truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff1a3c]" />
                        <span>{vt.event || 'Sem Evento'}</span>
                      </div>
                    )) : (
                      <span className="text-[10px] text-slate-600 italic">Sem eventos agendados</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Buscar por evento ou técnico..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full max-w-sm bg-[#121620] border border-[#1d2433] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff1a3c] transition-all"
        />
        {roomFilter !== 'all' && (
          <div className="flex items-center gap-1.5 bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span>Sala: {roomFilter}</span>
            <button onClick={() => setRoomFilter('all')} className="font-extrabold hover:text-[#ff1a3c] cursor-pointer">×</button>
          </div>
        )}
        {statusFilter !== 'all' && (
          <div className="flex items-center gap-1.5 bg-[#ff1a3c]/10 text-[#ff1a3c] border border-[#ff1a3c]/20 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span>Filtro: {statusFilter === 'today' ? 'Hoje' : statusFilter === 'pending' ? 'Pendentes' : 'Concluídas'}</span>
            <button onClick={() => setStatusFilter('all')} className="font-extrabold hover:text-white cursor-pointer">×</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredVTs.map(vt => (
          <VTCard
            key={vt.id}
            vt={vt}
            onComplete={handleComplete}
            onEdit={(vtToEdit) => {
              setEditingVT(vtToEdit);
              setIsModalOpen(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {filteredVTs.length === 0 && (
        <div className="text-center py-12 border border-dashed border-[#1d2433] rounded-xl text-xs text-slate-500 font-medium">
          Nenhuma Visita Técnica corresponde aos filtros ativos.
        </div>
      )}

      <ScheduleVTModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingVT={editingVT}
        availableRooms={availableRooms}
        onAddCustomRoom={handleAddCustomRoom}
        onSave={handleSave}
      />

      {isBriefingOpen && (
        <>
          <div
            onClick={() => setIsBriefingOpen(false)}
            className="fixed inset-0 bg-[#03050c]/70 backdrop-blur-sm z-[1000]"
          />
          <div className="fixed right-0 top-0 h-full w-[90%] max-w-[450px] bg-[#121620] border-l border-[#1d2433] shadow-[0_0_40px_rgba(0,0,0,0.5)] z-[1001] flex flex-col p-6 animate-in slide-in-from-right duration-300 text-left">
            <div className="flex justify-between items-center border-b border-[#1d2433] pb-4 mb-6 bg-[#121620]">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00e5ff]">mail</span>
                <span>Briefings e Notificações de Email</span>
              </h3>
              <button
                onClick={() => setIsBriefingOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/5 text-[#9ca3af] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto flex flex-col gap-4">
              {briefings.length === 0 ? (
                <div className="text-center text-xs text-slate-500 italic py-12">Nenhum briefing enviado ainda. Crie uma nova visita técnica para simular o disparo de briefings técnicos.</div>
              ) : (
                briefings.map(mail => (
                  <div key={mail.id} className="bg-[#090b11] border border-[#1d2433] p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] text-[#00e5ff] font-bold font-mono">ENVIADO</span>
                      <span className="text-[9px] text-slate-500">{formatTime(mail.createdAt)}</span>
                    </div>
                    <div className="text-xs">
                      <div className="text-slate-400 mb-0.5"><strong className="text-slate-300">Para:</strong> {mail.to}</div>
                      <div className="text-slate-400 mb-2"><strong className="text-slate-300">Assunto:</strong> {mail.subject}</div>
                      <div className="bg-[#121620] border border-[#1d2433]/40 p-2.5 rounded text-[11px] text-[#9ca3af] leading-relaxed whitespace-pre-line font-mono">
                        {mail.body}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
