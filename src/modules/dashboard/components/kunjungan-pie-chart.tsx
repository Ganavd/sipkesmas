"use client";

import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from "recharts";
import {
  PieChart as PieIcon,
  CheckCircle2,
  Clock,
  UserCheck,
  Activity,
  Calendar as CalendarIcon,
  RotateCcw,
  Check,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ROLES, type AppRole } from "@/lib/constants/roles";

interface KunjunganStatsProps {
  role: AppRole;
  totalKunjungan: number;
  belumKonfirmasiKeluarga: number;
  belumKonfirmasiKapus?: number;
  sedangDiproses?: number;
  sudahSelesai: number;
  isLoading?: boolean;
  onDateRangeChange?: (range: { from?: Date; to?: Date } | undefined) => void;
}

interface ChartDataItem {
  id: string;
  name: string;
  shortLabel: string;
  value: number;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
}

// Format range date to Indonesian human-readable string
function formatRentangTanggal(from: Date, to: Date): string {
  const fYear = from.getFullYear();
  const tYear = to.getFullYear();
  const fMonth = from.toLocaleDateString("id-ID", { month: "long" });
  const tMonth = to.toLocaleDateString("id-ID", { month: "long" });
  const fDay = from.getDate();
  const tDay = to.getDate();

  if (fYear === tYear && fMonth === tMonth && fDay === tDay) {
    return `${fDay} ${fMonth} ${fYear}`;
  }
  if (fYear === tYear && fMonth === tMonth) {
    return `${fDay} – ${tDay} ${fMonth} ${fYear}`;
  }
  if (fYear === tYear) {
    return `${fDay} ${fMonth} – ${tDay} ${tMonth} ${fYear}`;
  }
  return `${fDay} ${fMonth} ${fYear} – ${tDay} ${tMonth} ${tYear}`;
}

// Custom active shape for donut chart on hover
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: "drop-shadow(0px 6px 12px rgba(0,0,0,0.18))",
          transition: "all 0.3s ease-in-out",
        }}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={innerRadius - 5}
        outerRadius={innerRadius - 3}
        fill={fill}
      />
    </g>
  );
};

export function KunjunganPieChart({
  role,
  totalKunjungan = 0,
  belumKonfirmasiKeluarga = 0,
  belumKonfirmasiKapus = 0,
  sedangDiproses = 0,
  sudahSelesai = 0,
  isLoading = false,
  onDateRangeChange,
}: KunjunganStatsProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Active applied range vs temporary selection in calendar
  const [activeRange, setActiveRange] = useState<DateRange | undefined>(undefined);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined);

  const isKeluarga = role === ROLES.KELUARGA;

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) {
      // Re-sync picker selection with current active applied range
      setTempRange(activeRange);
    }
  };

  const handleClear = () => {
    setTempRange(undefined);
    setActiveRange(undefined);
    onDateRangeChange?.(undefined);
    setPopoverOpen(false);
  };

  const handleApply = () => {
    if (tempRange?.from) {
      const finalRange: DateRange = {
        from: tempRange.from,
        to: tempRange.to || tempRange.from,
      };
      setActiveRange(finalRange);
      onDateRangeChange?.({ from: finalRange.from, to: finalRange.to });
    } else {
      setActiveRange(undefined);
      onDateRangeChange?.(undefined);
    }
    setPopoverOpen(false);
  };

  // Build chart data items based on role
  const chartData: ChartDataItem[] = isKeluarga
    ? [
        {
          id: "belum_konfirmasi_keluarga",
          name: "Kunjungan Belum Dikonfirmasi",
          shortLabel: "Belum Dikonfirmasi",
          value: belumKonfirmasiKeluarga,
          color: "#f59e0b", // Amber 500
          bgColor: "bg-amber-500/10",
          textColor: "text-amber-700 dark:text-amber-400",
          borderColor: "border-amber-500/30",
          icon: Clock,
          description: "Draft kunjungan belum diajukan atau dikonfirmasi keluarga",
        },
        ...(sedangDiproses > 0
          ? [
              {
                id: "sedang_diproses",
                name: "Kunjungan Sedang Diproses",
                shortLabel: "Sedang Diproses",
                value: sedangDiproses,
                color: "#0284c7", // Sky 600
                bgColor: "bg-sky-500/10",
                textColor: "text-sky-700 dark:text-sky-400",
                borderColor: "border-sky-500/30",
                icon: Activity,
                description: "Kunjungan terdaftar sedang dalam penanganan tim kesehatan",
              },
            ]
          : []),
        {
          id: "sudah_selesai",
          name: "Kunjungan Sudah Selesai",
          shortLabel: "Sudah Selesai",
          value: sudahSelesai,
          color: "#10b981", // Emerald 500
          bgColor: "bg-emerald-500/10",
          textColor: "text-emerald-700 dark:text-emerald-400",
          borderColor: "border-emerald-500/30",
          icon: CheckCircle2,
          description: "Tindakan dan asuhan keperawatan telah selesai",
        },
      ]
    : [
        {
          id: "belum_konfirmasi_keluarga",
          name: "Belum Dikonfirmasi Keluarga",
          shortLabel: "Belum Konf. Keluarga",
          value: belumKonfirmasiKeluarga,
          color: "#f59e0b", // Amber 500
          bgColor: "bg-amber-500/10",
          textColor: "text-amber-700 dark:text-amber-400",
          borderColor: "border-amber-500/30",
          icon: Clock,
          description: "Status Draft, menunggu konfirmasi pengajuan dari keluarga",
        },
        {
          id: "belum_konfirmasi_kapus",
          name: "Belum Dikonfirmasi Kepala Puskesmas",
          shortLabel: "Belum Konf. Kepala Puskesmas",
          value: belumKonfirmasiKapus,
          color: "#0284c7", // Sky 600
          bgColor: "bg-sky-500/10",
          textColor: "text-sky-700 dark:text-sky-400",
          borderColor: "border-sky-500/30",
          icon: UserCheck,
          description: "Menunggu telaah Kepala Puskesmas & pembentukan tim tindak lanjut",
        },
        ...(sedangDiproses > 0
          ? [
              {
                id: "sedang_diproses",
                name: "Sedang Diproses",
                shortLabel: "Sedang Diproses",
                value: sedangDiproses,
                color: "#8b5cf6", // Violet 500
                bgColor: "bg-violet-500/10",
                textColor: "text-violet-700 dark:text-violet-400",
                borderColor: "border-violet-500/30",
                icon: Activity,
                description: "Kunjungan telah disetujui, menunggu perawat berkunjung ke keluarga binaan",
              },
            ]
          : []),
        {
          id: "sudah_selesai",
          name: "Sudah Selesai",
          shortLabel: "Sudah Selesai",
          value: sudahSelesai,
          color: "#10b981", // Emerald 500
          bgColor: "bg-emerald-500/10",
          textColor: "text-emerald-700 dark:text-emerald-400",
          borderColor: "border-emerald-500/30",
          icon: CheckCircle2,
          description: "Seluruh tindakan asuhan keperawatan telah tuntas terlaksana",
        },
      ];

  // Filter items with value > 0 for pie rendering (or fallback placeholder if all 0)
  const nonZeroData = chartData.filter((d) => d.value > 0);
  const hasData = totalKunjungan > 0 && nonZeroData.length > 0;
  const pieSourceData = hasData
    ? nonZeroData
    : [{ name: "Tidak ada data", value: 1, color: "oklch(0.85 0.02 240)" }];

  const onPieEnter = (_: any, index: number) => {
    if (hasData) setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  const formattedDateRangeText = activeRange?.from
    ? formatRentangTanggal(activeRange.from, activeRange.to || activeRange.from)
    : null;

  // Show "Bersihkan" button if there is an active filter OR if the user has selected a date in the picker
  const showClearButton = Boolean(activeRange?.from || tempRange?.from);

  return (
    <Card className="border-border/80 shadow-card overflow-hidden">
      <CardHeader className="border-b border-border/40 pb-4 bg-muted/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Header Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PieIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight flex flex-wrap items-baseline gap-2">
                <span>Grafik Data Distribusi Kunjungan</span>
                {formattedDateRangeText && (
                  <span className="text-xs sm:text-sm font-medium text-foreground">
                    {formattedDateRangeText}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {isKeluarga
                  ? "Ringkasan status pengajuan kunjungan kesehatan keluarga Anda"
                  : "Pemantauan komprehensif alur konfirmasi & penyelesaian kunjungan"}
              </CardDescription>
            </div>
          </div>

          {/* Area Kanan: Tombol Filter Tanggal dengan Popover Kalender */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 gap-2 px-3 text-xs font-medium rounded-lg border transition-all shadow-xs ${
                    activeRange?.from
                      ? "border-primary/40 bg-primary-soft/40 text-primary font-semibold hover:bg-primary-soft/60"
                      : "border-border/80 bg-card hover:bg-muted text-foreground"
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Filter Tanggal</span>
                  {activeRange?.from && (
                    <span className="h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-auto p-3 shadow-2xl border-border bg-popover rounded-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <p className="text-xs font-semibold text-foreground">
                      {!tempRange?.from
                        ? "Pilih Tanggal Mulai"
                        : !tempRange?.to
                        ? "Pilih Tanggal Akhir"
                        : "Rentang Tanggal Terpilih"}
                    </p>
                    {tempRange?.from && (
                      <span className="text-[11px] text-primary font-medium font-mono">
                        {formatRentangTanggal(tempRange.from, tempRange.to || tempRange.from)}
                      </span>
                    )}
                  </div>

                  <Calendar
                    mode="range"
                    selected={tempRange}
                    onSelect={(range) => {
                      setTempRange(range);
                    }}
                    numberOfMonths={1}
                    captionLayout="dropdown"
                    fromYear={2020}
                    toYear={2035}
                    className="rounded-md border border-border/40 p-1"
                  />

                  {/* Tombol Aksi di Bawah Kalender */}
                  <div className={`flex items-center pt-2 border-t border-border/60 ${showClearButton ? "justify-between" : "justify-end"}`}>
                    {showClearButton && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 px-2.5"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Bersihkan
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={handleApply}
                      disabled={!tempRange?.from}
                      className="h-8 text-xs font-medium gap-1.5 px-3.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Tampilkan
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 relative">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/60 backdrop-blur-xs rounded-b-xl">
            <div className="flex items-center gap-2 bg-popover px-4 py-2 rounded-xl shadow-lg border border-border text-xs font-medium text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
              Memuat data periode...
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Sisi Kiri: Diagram Donut Interaktif */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-full h-[280px] max-w-[320px] flex items-center justify-center">
              {/* Teks Tengah Donut: Total Kunjungan (Layer z-0 agar selalu di bawah Tooltip) */}
              <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none select-none">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Total
                </span>
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {totalKunjungan.toLocaleString("id-ID")}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Kunjungan
                </span>
              </div>

              <div className="relative z-10 w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      wrapperStyle={{ zIndex: 50, pointerEvents: "none", outline: "none" }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length || !hasData) return null;
                        const item = payload[0].payload as ChartDataItem;
                        const percentage =
                          totalKunjungan > 0
                            ? ((item.value / totalKunjungan) * 100).toFixed(1)
                            : "0";

                        return (
                          <div className="relative z-50 rounded-xl border border-border/90 bg-popover p-3.5 shadow-2xl backdrop-blur-md text-xs min-w-[210px] ring-1 ring-black/10 dark:ring-white/10">
                            <div className="flex items-center gap-2 mb-2 font-semibold text-foreground">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-xs font-bold leading-tight">{item.name}</span>
                            </div>
                            <div className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-2 text-muted-foreground">
                              <span className="font-mono text-base font-extrabold text-foreground">
                                {item.value.toLocaleString("id-ID")}{" "}
                                <span className="text-xs font-normal text-muted-foreground">
                                  kunjungan
                                </span>
                              </span>
                              <span
                                className="font-bold text-xs px-2 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: `${item.color}20`,
                                  color: item.color,
                                }}
                              >
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={pieSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={105}
                      paddingAngle={hasData ? 3 : 0}
                      dataKey="value"
                      activeIndex={activeIndex}
                      activeShape={hasData ? renderActiveShape : undefined}
                      onMouseEnter={onPieEnter}
                      onMouseLeave={onPieLeave}
                      animationDuration={900}
                      animationEasing="ease-out"
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {pieSourceData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="cursor-pointer transition-opacity duration-200 hover:opacity-90"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {hasData && (
              <p className="text-[11px] text-muted-foreground text-center mt-1">
                Arahkan kursor ke diagram untuk melihat detail persentase
              </p>
            )}
          </div>

          {/* Sisi Kanan: Legend & Kartu Metrik Interaktif */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {chartData.map((item, idx) => {
                const isHovered = activeIndex !== undefined && nonZeroData[activeIndex]?.id === item.id;
                const percentage =
                  totalKunjungan > 0
                    ? ((item.value / totalKunjungan) * 100).toFixed(1)
                    : "0";
                const IconComponent = item.icon;

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => {
                      const foundIdx = nonZeroData.findIndex((d) => d.id === item.id);
                      if (foundIdx !== -1) setActiveIndex(foundIdx);
                    }}
                    onMouseLeave={() => setActiveIndex(undefined)}
                    className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                      isHovered
                        ? `bg-muted/60 border-primary shadow-md ring-1 ring-primary/30 scale-[1.01]`
                        : `bg-card hover:bg-muted/30 border-border/70 hover:border-border`
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bgColor} ${item.textColor}`}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-semibold text-foreground line-clamp-1">
                            {item.name}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${item.bgColor} ${item.textColor}`}
                        >
                          {percentage}%
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between border-t border-border/40 pt-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Jumlah
                      </span>
                      <span className="text-lg font-bold tracking-tight text-foreground font-mono">
                        {item.value.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          data
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
