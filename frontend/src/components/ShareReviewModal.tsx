"use client";

import React, { useState, useEffect } from "react";
import { Mail, Copy, Check, ExternalLink, X, Send, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { reviewApi, SendReviewEmailData } from "@/lib/api";

interface ShareReviewModalProps {
  open: boolean;
  onClose: () => void;
  agencyId: string;
  deliverableId: string;
  deliverableTitle: string;
  token: string;
  initialReviewUrl: string;
  suggestedEmail?: string | null;
  suggestedName?: string | null;
  onEmailSent?: (result: SendReviewEmailData) => void;
}

export function ShareReviewModal({
  open,
  onClose,
  agencyId,
  deliverableId,
  deliverableTitle,
  token,
  initialReviewUrl,
  suggestedEmail,
  suggestedName,
  onEmailSent,
}: ShareReviewModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(suggestedEmail || "");
  const [customNote, setCustomNote] = useState("");
  const [moveToClientReview, setMoveToClientReview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendReviewEmailData | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRecipientEmail(suggestedEmail || "");
      setSendResult(null);
      setSendError(null);
      setCopied(false);
    }
  }, [open, suggestedEmail]);

  if (!open) return null;

  const displayUrl = sendResult?.full_review_url || initialReviewUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim() || sending) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const res = await reviewApi.sendReviewEmail(
        agencyId,
        deliverableId,
        {
          recipient_email: recipientEmail.trim(),
          custom_note: customNote.trim() || undefined,
          move_to_client_review: moveToClientReview,
        },
        token
      );
      setSendResult(res);
      if (!res.sent && res.error) {
        setSendError(res.error);
      } else if (res.sent && onEmailSent) {
        onEmailSent(res);
      }
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Failed to send magic review email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="surface-card border border-black/[0.08] dark:border-white/[0.1] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-[#191919] dark:text-[#F2F0F7]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-[#A78BFA]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold">Share &amp; Email Client Review Link</h3>
              <p className="text-xs text-[#6B6A65] dark:text-[#A3A0B0] line-clamp-1">{deliverableTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B6A65] dark:text-[#A3A0B0] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Copy Magic Link Box */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] block">
            Zero-Login Client Review Portal Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={displayUrl}
              className="flex-1 text-xs font-mono bg-[#F7F6F3] dark:bg-[#101014] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 text-[#191919] dark:text-[#F2F0F7]"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F7F6F3] hover:bg-[#EFEFED] dark:bg-[#20202A] dark:hover:bg-[#2A2A35] border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Preview Client Review Portal"
              className="p-2 rounded-xl bg-[#F7F6F3] hover:bg-[#EFEFED] dark:bg-[#20202A] dark:hover:bg-[#2A2A35] border border-black/[0.08] dark:border-white/[0.08] text-[#6B6A65] dark:text-[#A3A0B0]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Email Automation Form */}
        <form onSubmit={handleSendEmail} className="space-y-3 pt-3 border-t border-black/[0.08] dark:border-white/[0.08]">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] block mb-1">
              Client Email {suggestedName ? `(${suggestedName})` : ""}
            </label>
            <input
              type="email"
              required
              placeholder="client@company.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full text-xs bg-[#F7F6F3] dark:bg-[#101014] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 text-[#191919] dark:text-[#F2F0F7] focus:outline-none focus:border-violet-500/60"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#6B6A65] dark:text-[#A3A0B0] block mb-1">
              Note to Client (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Please review and let us know if we are good to schedule this post."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full text-xs bg-[#F7F6F3] dark:bg-[#101014] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 text-[#191919] dark:text-[#F2F0F7] focus:outline-none focus:border-violet-500/60 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#6B6A65] dark:text-[#A3A0B0] cursor-pointer">
            <input
              type="checkbox"
              checked={moveToClientReview}
              onChange={(e) => setMoveToClientReview(e.target.checked)}
              className="rounded border-black/20 dark:border-white/20 accent-violet-600"
            />
            <span>Move deliverable status to Client Review</span>
          </label>

          {sendResult?.sent && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Magic review email sent to <strong>{sendResult.recipient_email}</strong> via {sendResult.provider}.
              </span>
            </div>
          )}

          {sendError && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#6B6A65] dark:text-[#A3A0B0] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={sending || !recipientEmail.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 dark:bg-[#A78BFA] dark:hover:bg-[#B69BFF] text-white dark:text-[#101014] text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{sending ? "Sending Email..." : "Send Magic Link Email"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
