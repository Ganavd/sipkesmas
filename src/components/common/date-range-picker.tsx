"use client";

import * as React from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  /** Dipanggil saat user klik tombol Pilih (hanya muncul jika keduanya terisi) */
  onApply: () => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  onApply,
}: DateRangePickerProps) {
  const [openFrom, setOpenFrom] = React.useState(false);
  const [openTo, setOpenTo] = React.useState(false);

  const bothFilled = !!startDate && !!endDate;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mulai Tanggal */}
      <Popover open={openFrom} onOpenChange={setOpenFrom}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal bg-transparent shadow-none hover:bg-muted/20 border-border h-10 px-4",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {startDate ? format(startDate, "dd MMM yyyy", { locale: id }) : <span>Mulai Tanggal</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={(date) => {
              onChange({ from: date, to: endDate });
              if (date) {
                setOpenFrom(false);
                if (!endDate) setOpenTo(true);
              }
            }}
            initialFocus
          />
          {startDate && (
            <div className="border-t p-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs gap-1"
                onClick={() => {
                  onChange({ from: undefined, to: endDate });
                  setOpenFrom(false);
                }}
              >
                <X className="h-3 w-3" /> Bersihkan
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground font-medium px-1 select-none">-</span>

      {/* Sampai Tanggal */}
      <Popover open={openTo} onOpenChange={setOpenTo}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal bg-transparent shadow-none hover:bg-muted/20 border-border h-10 px-4",
              !endDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {endDate ? format(endDate, "dd MMM yyyy", { locale: id }) : <span>Sampai Tanggal</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate}
            onSelect={(date) => {
              onChange({ from: startDate, to: date });
              if (date) setOpenTo(false);
            }}
            disabled={startDate ? (date) => date < startDate : undefined}
            initialFocus
          />
          {endDate && (
            <div className="border-t p-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground text-xs gap-1"
                onClick={() => {
                  onChange({ from: startDate, to: undefined });
                  setOpenTo(false);
                }}
              >
                <X className="h-3 w-3" /> Bersihkan
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Tombol Pilih — hanya muncul jika kedua tanggal terisi */}
      {bothFilled && (
        <Button variant="outline" onClick={onApply} className="h-10">
          Pilih
        </Button>
      )}
    </div>
  );
}
