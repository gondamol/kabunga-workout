import { Clipboard, Check } from 'lucide-react';
import { useState } from 'react';
import { copyToClipboard } from '../../lib/utils';
import toast from 'react-hot-toast';

type ShareCodeChipProps = {
    code: string | null | undefined;
    label?: string;
    helper?: string;
    onShare?: () => void;
};

/** Compact share-code card with copy + share affordances. */
export function ShareCodeChip({ code, label = 'Coach code', helper, onShare }: ShareCodeChipProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!code) return;
        const ok = await copyToClipboard(code);
        if (ok) {
            setCopied(true);
            toast.success('Code copied');
            setTimeout(() => setCopied(false), 1600);
        } else {
            toast.error('Could not copy');
        }
    };

    return (
        <div className="rounded-2xl border border-border bg-bg-card p-4 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">{label}</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="font-display text-xl font-extrabold text-text-primary tabular-nums break-all">
                    {code ?? '—'}
                </p>
                <div className="flex gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!code}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-3 py-2 text-xs font-bold text-text-secondary disabled:opacity-40"
                    >
                        {copied ? <Check size={13} className="text-green" /> : <Clipboard size={13} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    {onShare && (
                        <button
                            type="button"
                            onClick={onShare}
                            disabled={!code}
                            className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-text-inverse disabled:opacity-40"
                        >
                            Share
                        </button>
                    )}
                </div>
            </div>
            {helper && <p className="mt-2 text-xs text-text-secondary leading-snug">{helper}</p>}
        </div>
    );
}
