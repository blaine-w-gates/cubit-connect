export default function SocialCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-500">
      <div
        className="relative w-[1200px] h-[630px] flex flex-col items-center justify-center bg-stone-900 text-white overflow-hidden border border-zinc-800"
        style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, #333 2%, transparent 0%)',
          backgroundSize: '50px 50px',
        }}
      >
        {/* Radial Gradient Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />

        {/* Logo: Isometric Cube */}
        <div className="relative mb-8">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="#4f46e5"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12.3712 0.518663C12.1438 0.384668 11.8562 0.384668 11.6288 0.518663L1.58334 6.43616C1.34448 6.57685 1.19995 6.83984 1.19995 7.1249V16.8749C1.19995 17.16 1.34448 17.4229 1.58334 17.5637L11.6288 23.4811C11.8562 23.6151 12.1438 23.6151 12.3712 23.4811L22.4167 17.5637C22.6555 17.4229 22.8 17.16 22.8 16.8749V7.1249C22.8 6.83984 22.6555 6.57685 22.4167 6.43616L12.3712 0.518663ZM12 2.45935L19.4678 6.85935L12 11.2593L4.53216 6.85935L12 2.45935ZM3.59995 8.44055L10.8 12.6824V21.1671L3.59995 16.9252V8.44055ZM13.2 21.1671V12.6824L20.4 8.44055V16.9252L13.2 21.1671Z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="relative font-serif text-[60px] font-black tracking-tight text-white mt-[30px] leading-tight">
          CUBIT CONNECT
        </h1>

        {/* Subtitle */}
        <p className="relative font-sans text-[30px] text-stone-400 mt-2 font-medium">
          Knowledge Distillation Engine
        </p>

        {/* Badge */}
        <div className="absolute bottom-10 bg-zinc-800 text-indigo-500 px-6 py-2 rounded-full text-[20px] font-bold tracking-wide border border-zinc-700/50">
          v1.0 BETA
        </div>
      </div>
    </div>
  );
}
