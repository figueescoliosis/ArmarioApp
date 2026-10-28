"use client";

/**
 * Planes apuntados, de los dos, día a día. Cada día lleva su tiempo para
 * saber si lo apuntado sigue teniendo sentido cuando llega la previsión.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { dayLabel, useWhere } from "@/components/outfits/DayWeatherPicker";
import { CoupleCard } from "@/components/outfits/CoupleCard";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { Button } from "@/components/ui/Button";
import { Cabecera } from "@/components/ui/Cabecera";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchOwners, fetchPlans, fetchWeather, logWear, removePlan } from "@/lib/client-api";
import type { DayWeather, Outfit, OwnersInfo, Plan } from "@/lib/types";

export default function CalendarioPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [owners, setOwners] = useState<OwnersInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<Record<string, DayWeather>>({});
  const [where] = useWhere();

  useEffect(() => {
    fetchOwners().then(setOwners, () => undefined);
    fetchPlans()
      .then(setPlans)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar los planes.");
      })
      .finally(() => setLoading(false));
  }, []);

  const days = [...new Set(plans.map((plan) => plan.day))];

  useEffect(() => {
    if (!where) return;
    for (const day of days) {
      if (weather[day] !== undefined) continue;
      fetchWeather(day, where).then(
        (result) => setWeather((current) => ({ ...current, [day]: result })),
        () => undefined,
      );
    }
    // Solo hace falta pedirlo cuando cambian los días o la ubicación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(","), where]);

  async function remove(plan: Plan) {
    try {
      await removePlan(plan.id);
      setPlans((current) => current.filter((p) => p.id !== plan.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo borrar el plan.");
    }
  }

  async function wear(outfit: Outfit) {
    await Promise.allSettled(outfit.items.map((item) => logWear(item.garment.id)));
  }

  const me = owners?.me.id;
  const partnerName = owners?.partner?.name ?? "tu pareja";

  return (
    <div className="space-y-6">
      <Cabecera
        adorno="conjuntos"
        titulo="Calendario"
        subtitulo="Lo que tenéis apuntado para los próximos días."
        accion={
          <Link href="/outfits">
            <Button>Apuntar</Button>
          </Link>
        }
      />

      {error !== null && (
        <p role="alert" className="rounded-[20px] border-[1.5px] border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!loading && plans.length === 0 && (
        <EmptyState
          title="Nada apuntado"
          message="En Conjuntos elige un día, genera y apunta el que os guste."
        />
      )}

      {days.map((day) => {
        const forecast = weather[day];
        return (
          <section key={day} className="space-y-3">
            <h2 className="titulo px-1 text-2xl first-letter:uppercase">{dayLabel(day)}</h2>
            {forecast !== undefined && (
              <p className="px-1 text-sm font-semibold text-sky-700">
                {forecast.minC}° – {forecast.maxC}°
                {forecast.rainProbability !== null && forecast.rainProbability >= 40
                  ? ` · ${forecast.rainProbability}% de lluvia`
                  : ""}
                {forecast.estimated ? " · estimado" : ""}
              </p>
            )}

            {plans
              .filter((plan) => plan.day === day)
              .map((plan) => (
                <div key={plan.id} className="space-y-2">
                  {plan.couple !== null ? (
                    <CoupleCard pair={plan.couple} partnerName={partnerName} onWear={(o) => void wear(o)} />
                  ) : plan.outfit !== null ? (
                    <>
                      {plan.ownerId !== me && (
                        <p className="px-1 text-xs font-bold tracking-[0.6px] text-ink-soft">
                          {partnerName.toUpperCase()}
                        </p>
                      )}
                      <OutfitCard
                        outfit={plan.outfit}
                        {...(plan.ownerId === me ? { onWear: (o: Outfit) => void wear(o) } : {})}
                      />
                    </>
                  ) : null}
                  {plan.ownerId === me && (
                    <Button variant="ghost" className="w-full" onClick={() => void remove(plan)}>
                      Quitar del calendario
                    </Button>
                  )}
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}
