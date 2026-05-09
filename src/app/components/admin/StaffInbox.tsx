import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle, GraduationCap, Clock, Check, X, Shield, Megaphone } from 'lucide-react';
import { useStaffAPI } from '../../hooks/useStaffAPI';
import { useAnnouncements } from '../../contexts/AnnouncementsContext';

const SURF = '#1E1E1F';
const BORDER = 'rgba(255,255,255,0.06)';
const TS = '#9294A0';

type InboxSubTab = 'cancellations' | 'coaching' | 'announcements';

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function StaffInbox() {
  const { getPendingRequests, approveCancellationRequest, rejectCancellationRequest, verifyCoachingPayment, rejectCoachingPayment } = useStaffAPI();
  const { addAnnouncement, announcements } = useAnnouncements();
  
  const [sub, setSub] = useState<InboxSubTab>('cancellations');
  const [requests, setRequests] = useState<any>({ cancellations: [], coaching: [] });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'promotion' as const });
  const [announceSent, setAnnounceSent] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'cancellation' | 'coaching'; id: string; approved: boolean } | null>(null);

  const fetchInboxData = async () => {
    try {
      const data = await getPendingRequests();
      if (data) {
        setRequests({
          cancellations: data.cancellations || [],
          coaching: data.coaching || []
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInboxData();
    const int = setInterval(fetchInboxData, 15000);
    return () => clearInterval(int);
  }, []);

  const handleApprove = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'cancellation') {
      if (confirmAction.approved) {
        await approveCancellationRequest(confirmAction.id);
      } else {
        await rejectCancellationRequest(confirmAction.id, "Staff declined your request.");
      }
    } else if (confirmAction.type === 'coaching') {
      if (confirmAction.approved) {
        await verifyCoachingPayment(confirmAction.id);
      } else {
        await rejectCoachingPayment(confirmAction.id, "Payment verification failed.");
      }
    }
    setConfirmAction(null);
    fetchInboxData();
  };

  const handleSendAnnounce = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementForm.title || !announcementForm.message) return;
    addAnnouncement({ ...announcementForm, date: new Date().toISOString() });
    setAnnounceSent('Announcement published!');
    setAnnouncementForm({ title: '', message: '', type: 'promotion' });
    setTimeout(() => setAnnounceSent(''), 3000);
  };

  const pendingCancellations = requests.cancellations.length;
  const pendingCoaching = requests.coaching.length;

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden pb-[80px] md:pb-0" style={{ background: '#131314' }}>
      
      {/* SIDEBAR FOR DESKTOP */}
      <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r overflow-y-auto" style={{ borderColor: BORDER, background: SURF }}>
        <div className="p-5">
          <h2 className="text-white font-black" style={{ fontSize: 24 }}>Front Desk Inbox</h2>
          <p style={{ color: TS, fontSize: 13, marginTop: 4 }}>Review pending requests from users and coaches</p>
        </div>

        <div className="px-3 pb-4 space-y-1">
          {[
            { id: 'cancellations' as InboxSubTab, label: 'Cancellations',   icon: AlertTriangle, badge: pendingCancellations, color: '#fbbf24' },
            { id: 'coaching'      as InboxSubTab, label: 'Coaching Fees',   icon: GraduationCap, badge: pendingCoaching,       color: '#60a5fa' },
            { id: 'announcements' as InboxSubTab, label: 'Announcements',   icon: Megaphone,     badge: 0,                    color: '#FF8C00' },
          ].map(t => (
            <button key={t.id} onClick={() => setSub(t.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: sub === t.id ? `${t.color}20` : 'transparent',
                color: sub === t.id ? t.color : TS
              }}>
              <div className="flex items-center gap-2.5">
                <t.icon size={16} />
                <span className="font-black" style={{ fontSize: 13 }}>{t.label}</span>
              </div>
              {t.badge > 0 && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-black"
                  style={{ fontSize: 10, background: t.color }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          
          <AnimatePresence mode="wait">
            
            {sub === 'cancellations' && (
              <motion.div key="cancellations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                {requests.cancellations.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#22c55e' }} />
                    <p className="text-white font-black" style={{ fontSize: 16 }}>All caught up</p>
                    <p style={{ color: TS, fontSize: 13 }}>No pending cancellation requests</p>
                  </div>
                ) : (
                  requests.cancellations.map((r: any) => (
                    <div key={r.id} className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: SURF, borderColor: BORDER }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-black"
                          style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', fontSize: 13 }}>
                          {initials(r.customerName || 'US')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-black" style={{ fontSize: 15 }}>{r.customerName || 'User Request'}</span>
                            <span className="px-2 py-0.5 rounded text-yellow-400 font-bold" style={{ fontSize: 10, background: 'rgba(250,204,21,0.1)' }}>PENDING</span>
                          </div>
                          <p style={{ color: TS, fontSize: 13 }}>{r.date} · {r.time} · {r.court}</p>
                          <p className="mt-2 text-white italic" style={{ fontSize: 13 }}>Reason: "{r.reason}"</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full md:w-auto">
                        {confirmAction?.id === r.id ? (
                          <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => handleApprove()} className="flex-1 md:flex-none px-4 py-2 rounded-lg font-black text-white bg-green-500 hover:bg-green-600 transition-all text-xs">Confirm {confirmAction.approved ? 'Approve' : 'Reject'}</button>
                            <button onClick={() => setConfirmAction(null)} className="flex-1 md:flex-none px-4 py-2 rounded-lg font-black text-white bg-gray-600 hover:bg-gray-500 transition-all text-xs">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setConfirmAction({ type: 'cancellation', id: r.id, approved: true })}
                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black transition-all"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                              <Check size={14} /> Approve
                            </button>
                            <button onClick={() => setConfirmAction({ type: 'cancellation', id: r.id, approved: false })}
                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black transition-all"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {sub === 'coaching' && (
              <motion.div key="coaching" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
                {requests.coaching.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#22c55e' }} />
                    <p className="text-white font-black" style={{ fontSize: 16 }}>All caught up</p>
                    <p style={{ color: TS, fontSize: 13 }}>No pending coaching verifications</p>
                  </div>
                ) : (
                  requests.coaching.map((r: any) => (
                    <div key={r.id} className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ background: SURF, borderColor: BORDER }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-black"
                          style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', fontSize: 13 }}>
                          {initials(r.userName || 'US')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-black" style={{ fontSize: 15 }}>{r.userName}</span>
                            <span className="px-2 py-0.5 rounded text-blue-400 font-bold" style={{ fontSize: 10, background: 'rgba(96,165,250,0.1)' }}>VERIFY PAYMENT</span>
                          </div>
                          <p style={{ color: TS, fontSize: 13 }}>Coach: {r.coachName} · {r.sport}</p>
                          <p style={{ color: TS, fontSize: 12 }}>{r.requestedDate} · {r.requestedTime}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full md:w-auto">
                        {confirmAction?.id === r.id ? (
                          <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => handleApprove()} className="flex-1 md:flex-none px-4 py-2 rounded-lg font-black text-white bg-green-500 transition-all text-xs">Verify Real?</button>
                            <button onClick={() => setConfirmAction(null)} className="flex-1 md:flex-none px-4 py-2 rounded-lg font-black text-white bg-gray-600 transition-all text-xs">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setConfirmAction({ type: 'coaching', id: r.id, approved: true })}
                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black transition-all"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                              <Check size={14} /> Verify
                            </button>
                            <button onClick={() => setConfirmAction({ type: 'coaching', id: r.id, approved: false })}
                              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-black transition-all"
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                              <X size={14} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {sub === 'announcements' && (
              <motion.div key="announcements" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <form onSubmit={handleSendAnnounce} className="p-4 rounded-xl border space-y-4 mb-4" style={{ background: SURF, borderColor: BORDER }}>
                  <div>
                    <label className="block text-white font-black mb-1.5" style={{ fontSize: 13 }}>Announcement Title</label>
                    <input type="text" value={announcementForm.title} onChange={e => setAnnouncementForm(prev => ({...prev, title: e.target.value}))}
                      className="w-full bg-black/30 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none" style={{ borderColor: BORDER }} placeholder="e.g., Happy Holidays!" required />
                  </div>
                  <div>
                    <label className="block text-white font-black mb-1.5" style={{ fontSize: 13 }}>Message Body</label>
                    <textarea value={announcementForm.message} onChange={e => setAnnouncementForm(prev => ({...prev, message: e.target.value}))}
                      className="w-full bg-black/30 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none h-24" style={{ borderColor: BORDER }} placeholder="Enter message..." required />
                  </div>
                  <button type="submit" className="w-full py-2.5 rounded-lg text-white font-black transition-all"
                    style={{ background: 'linear-gradient(135deg,#FF8C00,#EA580C)', fontSize: 14 }}>
                    Push &amp; Blast Message
                  </button>
                  {announceSent && <p className="text-green-400 text-center font-bold text-sm">{announceSent}</p>}
                </form>

                <div className="space-y-3">
                  <h3 className="text-white font-black mb-2" style={{ fontSize: 15 }}>Recent Broadcasts</h3>
                  {announcements.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl border flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.02)', borderColor: BORDER }}>
                      <Megaphone size={16} className="text-orange-400 mt-0.5" />
                      <div>
                        <p className="text-white font-black" style={{ fontSize: 14 }}>{a.title}</p>
                        <p style={{ color: TS, fontSize: 12 }} className="mb-1">{new Date(a.date).toLocaleString()}</p>
                        <p style={{ color: '#ccc', fontSize: 13 }}>{a.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}