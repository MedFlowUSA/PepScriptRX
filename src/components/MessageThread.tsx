import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/index';
import { useRealtime } from '../hooks/useRealtime';

type Message = {
  id: string;
  submission_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string; role: string } | null;
};

const STAFF_ROLES = ['admin', 'physician', 'fulfillment'];

export function MessageThread({ submissionId, profile }: { submissionId: string; profile: Profile }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStaff = STAFF_ROLES.includes(profile.role);

  const loadMessages = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('submission_messages')
      .select('*, sender:profiles(full_name, role)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [submissionId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useRealtime(
    `messages-${submissionId}`,
    'submission_messages',
    `submission_id=eq.${submissionId}`,
    loadMessages,
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !body.trim()) return;
    setSending(true);
    await supabase.from('submission_messages').insert({
      submission_id: submissionId,
      sender_profile_id: profile.id,
      body: body.trim(),
    });
    setBody('');
    setSending(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : messages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No messages yet. {isStaff ? 'Send the patient a message.' : 'Send a message to the care team.'}
          </p>
        ) : messages.map((msg) => {
          const fromMe = msg.sender_profile_id === profile.id;
          const senderLabel = fromMe
            ? 'You'
            : isStaff
              ? (msg.sender?.full_name ?? 'Patient')
              : 'Care Team';
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: fromMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                background: fromMe ? 'var(--teal)' : 'var(--surface-2)',
                color: fromMe ? '#fff' : 'var(--navy)',
                borderRadius: fromMe ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
                padding: '8px 13px',
                fontSize: 14,
                lineHeight: 1.55,
                wordBreak: 'break-word',
              }}>
                {msg.body}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {senderLabel} · {new Date(msg.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <input
          className="form-input"
          style={{ flex: 1, fontSize: 14 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isStaff ? 'Message to patient…' : 'Message to care team…'}
          required
        />
        <button
          className="btn btn-primary btn-sm"
          disabled={sending || !body.trim()}
          style={{ flexShrink: 0, justifyContent: 'center', minWidth: 60 }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
