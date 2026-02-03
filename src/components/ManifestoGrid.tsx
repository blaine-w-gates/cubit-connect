export default function ManifestoGrid() {
  return (
    <div className="w-full bg-white text-[#111111] font-sans rounded-none border-b border-black">
      {/* Brutalist Header */}
      <div className="border-b border-black p-6 md:p-8 bg-[#FAFAFA]">
        <h1 className="text-4xl md:text-6xl font-serif font-black tracking-tight leading-[0.9]">
          Recipes for Life
        </h1>
        <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 text-sm font-mono uppercase tracking-widest text-zinc-500">
          <span>Vol. 1.0</span>
          <span className="hidden md:inline">•</span>
          <span>The Methodology</span>
        </div>
      </div>

      {/* 4-Column Table (Responsive: 1 -> 2 -> 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 gap-px bg-black border-t border-black">
        {/* Col 1: The Search */}
        <div className="p-6 h-full flex flex-col bg-[#FAFAFA]">
          <span className="font-mono text-xs text-zinc-500 mb-2 uppercase tracking-wide">
            Step 01
          </span>
          <h2 className="font-serif text-2xl font-bold mb-3 italic">The Search</h2>
          <p className="text-sm leading-relaxed opacity-80 font-mono">
            Feature: Intentional Search Triggers. Benefit: Retrains your algorithm to serve skills,
            not distractions.{' '}
            <strong className="opacity-100">
              Advantage: You control the feed; the feed does not control you.
            </strong>
          </p>
        </div>

        {/* Col 2: The Curation */}
        <div className="p-6 h-full flex flex-col bg-[#FAFAFA]">
          <span className="font-mono text-xs text-zinc-500 mb-2 uppercase tracking-wide">
            Step 02
          </span>
          <h2 className="font-serif text-2xl font-bold mb-3 italic">The Curation</h2>
          <p className="text-sm leading-relaxed opacity-80 font-mono">
            Feature: High-Signal Filtering. Benefit: Isolates the 1 post that teaches vs. the 10
            that entertain.{' '}
            <strong className="opacity-100">
              Advantage: Build a library of knowledge, not a graveyard of likes.
            </strong>
          </p>
        </div>

        {/* Col 3: The Extraction */}
        <div className="p-6 h-full flex flex-col bg-[#FAFAFA]">
          <span className="font-mono text-xs text-zinc-500 mb-2 uppercase tracking-wide">
            Step 03
          </span>
          <h2 className="font-serif text-2xl font-bold mb-3 italic">The Extraction</h2>
          <p className="text-sm leading-relaxed opacity-80 font-mono">
            Feature: The AI Extraction Engine. Benefit: Fills the instructional gaps that
            influencers leave out.{' '}
            <strong className="opacity-100">
              Advantage: Unlock the full, paid-course value from a free 60-second clip.
            </strong>
          </p>
        </div>

        {/* Col 4: The Output */}
        <div className="p-6 h-full flex flex-col bg-[#FAFAFA]">
          <span className="font-mono text-xs text-zinc-500 mb-2 uppercase tracking-wide">
            Step 04
          </span>
          <h2 className="font-serif text-2xl font-bold mb-3 italic">The Output</h2>
          <p className="text-sm leading-relaxed opacity-80 font-mono">
            Feature: The Authority Builder. Benefit: Turns passive consumption into active
            contribution.{' '}
            <strong className="opacity-100">
              Advantage: Stop being the audience. Start being the Expert.
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
