"use client";

import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface SessionDateDisplayProps {
  isoString: string;
}

export function SessionDateDisplay({ isoString }: SessionDateDisplayProps) {
  const date = new Date(isoString);
  return (
    <>
      {format(date, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
    </>
  );
}
