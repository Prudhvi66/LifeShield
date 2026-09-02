import React, { useState } from 'react';
import { UserPlus, Trash2, Phone, Bell, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmergencyContact } from '../../types/emergency';

export const EmergencyContactsManager: React.FC = () => {
  const { user, updateUser } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRel, setNewRel] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(1);
  const [newAutoNotify, setNewAutoNotify] = useState(true);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const contact: EmergencyContact = {
      id: `cnt-${Date.now()}`,
      name: newName.trim(),
      relationship: newRel.trim() || 'Family',
      phone: newPhone.trim(),
      priority: newPriority,
      autoNotify: newAutoNotify,
    };

    updateUser(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, contact]
    }));

    setNewName('');
    setNewRel('');
    setNewPhone('');
    setShowAddForm(false);
  };

  const handleDeleteContact = (id: string) => {
    updateUser(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter(c => c.id !== id)
    }));
  };

  const handleToggleAutoNotify = (id: string) => {
    updateUser(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map(c =>
        c.id === id ? { ...c, autoNotify: !c.autoNotify } : c
      )
    }));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-400" />
            Configured Emergency Contacts ({user.emergencyContacts.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Contacts receive automatic SMS & WhatsApp alerts with your live location during confirmed emergencies.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Add Contact Modal / Form Inline */}
      {showAddForm && (
        <form onSubmit={handleAddContact} className="p-4 bg-slate-950/80 border border-slate-700 rounded-xl space-y-3 animate-in fade-in">
          <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">New Emergency Contact</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Relationship</label>
              <input
                type="text"
                placeholder="e.g. Daughter, Caregiver"
                value={newRel}
                onChange={e => setNewRel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAutoNotify}
                  onChange={e => setNewAutoNotify(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 bg-slate-800 border-slate-700"
                />
                <span>Automatically notify in emergency</span>
              </label>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>Priority:</span>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(Number(e.target.value) as 1 | 2 | 3)}
                  className="bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-white"
                >
                  <option value={1}>Priority 1 (Primary)</option>
                  <option value={2}>Priority 2 (Secondary)</option>
                  <option value={3}>Priority 3 (Tertiary)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md"
              >
                Save Contact
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Contact Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {user.emergencyContacts.map((contact) => (
          <div
            key={contact.id}
            className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{contact.name}</span>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {contact.relationship}
                </span>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
                  P{contact.priority}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-emerald-400" />
                {contact.phone}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleAutoNotify(contact.id)}
                title={contact.autoNotify ? 'Auto-notify enabled' : 'Auto-notify disabled'}
                className={`p-2 rounded-lg text-xs border transition-colors ${
                  contact.autoNotify
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>

              <a
                href={`tel:${contact.phone}`}
                className="p-2 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/40 transition-colors"
                title="Call Contact"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => handleDeleteContact(contact.id)}
                className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
                title="Delete Contact"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
