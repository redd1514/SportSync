import sys

with open('../src/app/components/mobile/MobileFacilityMap.tsx', 'r') as f:
    content = f.read()

old_str = """      {/* Sport mode selectors (facility only) */}
      {floor === "facility" && (
        <div className="flex-shrink-0 px-3 py-2 bg-[#111111] border-b border-white/5 space-y-1.5">
          {/* Court mode */}
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <span className="text-gray-600 flex-shrink-0" style={{ fontSize: 9, fontWeight: 800 }}>COURT:</span>
            {courtModes.map(m => {
              const color = getSportColor(m);
              const active = courtMode === m;
              return (
                <button key={m} onClick={() => { setCourtMode(m); setSelectedCourt(null); }}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border transition-all"
                  style={{
                    fontSize: 9, fontWeight: 800,
                    backgroundColor: active ? `${color}20` : "#1A1A1A",
                    borderColor: active ? color : "rgba(255,255,255,0.06)",
                    color: active ? color : "#555",
                  }}
                >
                  <SportIcon sport={m} size={9} color={active ? color : "#555"} strokeWidth={2} />
                  {m}
                </button>
              );
            })}
          </div>
          {/* Table mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600 flex-shrink-0" style={{ fontSize: 9, fontWeight: 800 }}>TABLES:</span>
            {tableModes.map(m => {
              const color = getSportColor(m);
              const active = tableMode === m;
              return (
                <button key={m} onClick={() => { setTableMode(m); setSelectedCourt(null); }}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border transition-all"
                  style={{
                    fontSize: 9, fontWeight: 800,
                    backgroundColor: active ? `${color}20` : "#1A1A1A",
                    borderColor: active ? color : "rgba(255,255,255,0.06)",
                    color: active ? color : "#555",
                  }}
                >
                  <SportIcon sport={m} size={9} color={active ? color : "#555"} strokeWidth={2} />
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-1.5 bg-[#111111] border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span className="text-gray-400" style={{ fontSize: 10, fontWeight: 700 }}>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-700" />
          <span className="text-gray-400" style={{ fontSize: 10, fontWeight: 700 }}>Occupied</span>
        </div>
        <span className="ml-auto text-gray-600" style={{ fontSize: 10 }}>Tap court for details</span>
      </div>"""

new_str = """      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Sport mode selectors (facility only) */}
        {floor === "facility" && (
          <div className="flex-shrink-0 flex flex-col md:w-[220px] bg-[#111111] border-b md:border-b-0 md:border-r border-white/5 space-y-1.5 md:space-y-6 px-3 py-2 md:p-5 overflow-y-auto">
            {/* Court mode */}
            <div className="flex items-center md:flex-col md:items-start gap-1.5 md:gap-3 overflow-x-auto md:overflow-visible" style={{ scrollbarWidth: "none" }}>
              <span className="text-gray-600 flex-shrink-0" style={{ fontSize: 9, fontWeight: 800 }}>COURT:</span>
              <div className="flex md:flex-col gap-1.5 w-full">
                {courtModes.map(m => {
                  const color = getSportColor(m);
                  const active = courtMode === m;
                  return (
                    <button key={m} onClick={() => { setCourtMode(m); setSelectedCourt(null); }}
                      className="flex-shrink-0 flex items-center gap-1 md:gap-2 px-2 py-1 md:py-2.5 rounded-md md:rounded-lg border transition-all md:w-full md:justify-start"
                      style={{
                        fontSize: 9, fontWeight: 800,
                        backgroundColor: active ? `${color}20` : "#1A1A1A",
                        borderColor: active ? color : "rgba(255,255,255,0.06)",
                        color: active ? color : "#555",
                      }}
                    >
                      <SportIcon sport={m} size={11} color={active ? color : "#555"} strokeWidth={2} />
                      <span className="md:text-[11px]">{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Table mode */}
            <div className="flex items-center md:flex-col md:items-start gap-1.5 md:gap-3 overflow-x-auto md:overflow-visible" style={{ scrollbarWidth: "none" }}>
              <span className="text-gray-600 flex-shrink-0" style={{ fontSize: 9, fontWeight: 800 }}>TABLES:</span>
              <div className="flex md:flex-col gap-1.5 w-full">
                {tableModes.map(m => {
                  const color = getSportColor(m);
                  const active = tableMode === m;
                  return (
                    <button key={m} onClick={() => { setTableMode(m); setSelectedCourt(null); }}
                      className="flex-shrink-0 flex items-center gap-1 md:gap-2 px-2 py-1 md:py-2.5 rounded-md md:rounded-lg border transition-all md:w-full md:justify-start"
                      style={{
                        fontSize: 9, fontWeight: 800,
                        backgroundColor: active ? `${color}20` : "#1A1A1A",
                        borderColor: active ? color : "rgba(255,255,255,0.06)",
                        color: active ? color : "#555",
                      }}
                    >
                      <SportIcon sport={m} size={11} color={active ? color : "#555"} strokeWidth={2} />
                      <span className="md:text-[11px]">{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Legend */}
            <div className="hidden md:flex flex-col gap-3 pt-4 mt-auto border-t border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span className="text-gray-400" style={{ fontSize: 11, fontWeight: 700 }}>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-700" />
                <span className="text-gray-400" style={{ fontSize: 11, fontWeight: 700 }}>Occupied</span>
              </div>
              <span className="text-gray-600 mt-2" style={{ fontSize: 10 }}>Tap court for details</span>
            </div>
          </div>
        )}

        {/* Mobile Legend */}
        <div className="md:hidden flex-shrink-0 flex items-center gap-4 px-4 py-1.5 bg-[#111111] border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
            <span className="text-gray-400" style={{ fontSize: 10, fontWeight: 700 }}>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-700" />
            <span className="text-gray-400" style={{ fontSize: 10, fontWeight: 700 }}>Occupied</span>
          </div>
          <span className="ml-auto text-gray-600" style={{ fontSize: 10 }}>Tap court for details</span>
        </div>"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('../src/app/components/mobile/MobileFacilityMap.tsx', 'w') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Not found")
