{/* Vertical Navigation (Up/Down) */}
  <div className="flex flex-col items-center gap-2 mt-6">
    <button
      onClick={handleUpArrow}
      className="p-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110 w-full text-center"
    >
      <ArrowUp className="text-cyan-400" size={24} />
      <span className="text-xs text-cyan-400">UP</span>
    </button>
    <button
      onClick={handleDownArrow}
      className="p-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110 w-full text-center"
    >
      <ArrowDown className="text-cyan-400" size={24} />
      <span className="text-xs text-cyan-400">DOWN</span>
    </button>
  </div>