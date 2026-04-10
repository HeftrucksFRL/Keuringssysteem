"use client";

import Link from "next/link";
import { useState } from "react";

interface LinkedBatterySummary {
  id: string;
  customerId: string;
  title: string;
  internalNumber: string;
  serialNumber: string;
  batteryLabel: string;
  chargerLabel: string;
}

interface LinkedBatteryDialogProps {
  machineId: string;
  items: LinkedBatterySummary[];
}

export function LinkedBatteryDialog({
  machineId,
  items
}: LinkedBatteryDialogProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <button className="button-secondary" type="button" onClick={() => setOpen(true)}>
        Bekijk batterij / lader ({items.length})
      </button>
      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.42)",
            display: "grid",
            placeItems: "center",
            zIndex: 80,
            padding: "1rem"
          }}
        >
          <div
            className="panel"
            style={{
              width: "min(720px, 100%)",
              maxHeight: "80vh",
              overflowY: "auto"
            }}
          >
            <div className="actions" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <div className="eyebrow">Gekoppelde batterij / lader</div>
                <h2 style={{ margin: "0.25rem 0 0" }}>Machine {machineId}</h2>
              </div>
              <button className="button-secondary" type="button" onClick={() => setOpen(false)}>
                Sluiten
              </button>
            </div>
            <div className="dataset-list">
              {items.map((item) => (
                <div className="dataset-row" key={item.id}>
                  <strong>{item.title}</strong>
                  <span>Intern nummer: {item.internalNumber || "-"}</span>
                  <span>Serienummer: {item.serialNumber || "-"}</span>
                  <span>{item.batteryLabel || "Batterij: -"}</span>
                  <span>{item.chargerLabel || "Lader: -"}</span>
                  <div className="actions">
                    <Link className="button-secondary" href={`/machines/${item.id}`}>
                      Open kaart
                    </Link>
                    <Link
                      className="button"
                      href={`/keuringen/nieuw?customerId=${item.customerId}&machineId=${item.id}`}
                    >
                      Start keuring
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
