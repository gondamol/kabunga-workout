import { BookOpen, ExternalLink, FlaskConical, Target } from 'lucide-react';
import { InsightCard, PageHeader } from '../components/ui';

const principles = [
    {
        title: 'Progressive Overload',
        detail: 'Track sets, reps, and load over time so your training stimulus gradually increases.',
    },
    {
        title: 'Sufficient Weekly Volume',
        detail: 'Plans prioritize enough hard sets per muscle group each week for measurable growth.',
    },
    {
        title: 'Balanced Movement Patterns',
        detail: 'Templates balance push, pull, squat, hinge, and core work for full-body development.',
    },
    {
        title: 'Rest Interval Control',
        detail: 'Rest targets are built into sessions to support quality performance across all sets.',
    },
];

const references = [
    {
        title: 'ACSM Position Stand: Progression Models in Resistance Training for Healthy Adults',
        citation: 'Med Sci Sports Exerc. 2009.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/',
    },
    {
        title: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass',
        citation: 'J Sports Sci. 2017 (meta-analysis).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/',
    },
    {
        title: 'Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis',
        citation: 'Sports Med. 2018 (meta-analysis).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/29553038/',
    },
    {
        title: 'Longer inter-set rest periods enhance muscle strength and hypertrophy',
        citation: 'J Strength Cond Res. 2016.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26605807/',
    },
    {
        title: 'Protein supplementation and resistance training-induced gains in muscle mass and strength',
        citation: 'Br J Sports Med. 2018 (meta-analysis).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
    },
];

export default function SciencePage() {
    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">
            <PageHeader
                eyebrow="Kabunga Method"
                title="Evidence-based coaching"
                subtitle="Training science explained simply, then connected back to your next workout decision."
                action={<FlaskConical size={24} className="text-primary" />}
            />

            <InsightCard
                tone="recovery"
                title="Science should reduce decisions"
                description="Kabunga turns principles like progressive overload, rest, weekly volume, and protein support into practical guidance instead of dense lectures."
            />

            <div className="glass rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Target size={15} className="text-accent" />
                    How Kabunga Coaches You
                </h3>
                <div className="space-y-2">
                    {principles.map((principle) => (
                        <div key={principle.title} className="rounded-xl border border-border bg-bg-card p-3">
                            <p className="text-sm font-semibold">{principle.title}</p>
                            <p className="text-xs text-text-secondary mt-1">{principle.detail}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen size={15} className="text-accent" />
                    Peer-Reviewed References
                </h3>
                <div className="space-y-2">
                    {references.map((reference) => (
                        <a
                            key={reference.url}
                            href={reference.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-border bg-bg-card p-3 block hover:border-accent/40 transition-colors"
                        >
                            <p className="text-sm font-semibold">{reference.title}</p>
                            <p className="text-xs text-text-secondary mt-1">{reference.citation}</p>
                            <p className="text-xs text-accent mt-2 inline-flex items-center gap-1">
                                Open source
                                <ExternalLink size={12} />
                            </p>
                        </a>
                    ))}
                </div>
                <p className="text-[11px] text-text-muted">
                    Educational guidance only. For injuries, medical conditions, or nutrition therapy, consult a licensed professional.
                </p>
            </div>
        </div>
    );
}
