import { useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { useBusiness } from "@/hooks/useBusiness";
import {
  businessApi,
  flavorsApi,
  locationsApi,
} from "@/services/api";
import { formatMoney } from "@/lib/formatting/currency";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { IconPlus } from "@/components/ui/icons";

// ---------------------------------------------------------------------
// Ajustes: nombre, logo (color), precios por defecto, moneda, contacto,
// pie de reporte, ubicaciones y sabores. Nalu es la configuración
// inicial; la lógica de negocio no depende del nombre.
// ---------------------------------------------------------------------

export function SettingsPage() {
  const { toast } = useToast();
  const { business, reload, currency } = useBusiness();

  const [name, setName] = useState(business?.name ?? "");
  const [contact, setContact] = useState(business?.contact ?? "");
  const [reportFooter, setReportFooter] = useState(business?.reportFooter ?? "");
  const [primaryColor, setPrimaryColor] = useState(business?.primaryColor ?? "#36C9C6");
  const [secondaryColor, setSecondaryColor] = useState(business?.secondaryColor ?? "#FF6F91");
  const [purchaseCost, setPurchaseCost] = useState(String(business?.defaultPurchaseCost ?? 28));
  const [homePrice, setHomePrice] = useState(String(business?.defaultHomePrice ?? 60));
  const [saving, setSaving] = useState(false);

  const locations = useAsync(() => locationsApi.list(true), []);
  const flavors = useAsync(() => flavorsApi.list(true), []);

  const [newLocation, setNewLocation] = useState("");
  const [locationModal, setLocationModal] = useState(false);
  const [newFlavor, setNewFlavor] = useState("");
  const [flavorModal, setFlavorModal] = useState(false);

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await businessApi.update({
        name,
        contact: contact || null,
        reportFooter: reportFooter || null,
        primaryColor,
        secondaryColor,
        defaultPurchaseCost: Number(purchaseCost) || 0,
        defaultHomePrice: Number(homePrice) || 0,
      });
      reload();
      toast("Ajustes guardados");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudieron guardar los ajustes", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLocation() {
    if (!newLocation.trim()) return;
    try {
      await locationsApi.create({ name: newLocation.trim() });
      locations.reload();
      setNewLocation("");
      setLocationModal(false);
      toast("Ubicación agregada");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo agregar", "error");
    }
  }

  async function handleAddFlavor() {
    if (!newFlavor.trim()) return;
    try {
      await flavorsApi.create({ name: newFlavor.trim() });
      flavors.reload();
      setNewFlavor("");
      setFlavorModal(false);
      toast("Sabor agregado");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo agregar", "error");
    }
  }

  if (!business) return <PageLoader label="Cargando ajustes…" />;

  return (
    <div className="animate-fade-up space-y-5">
      <h1 className="text-2xl font-black text-cocoa">Ajustes ⚙️</h1>

      {/* Negocio */}
      <Card>
        <CardHeader title="Tu negocio" subtitle="La información que aparece en reportes y mensajes" />
        <div className="space-y-4">
          <Input label="Nombre del negocio" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-sm font-bold text-cocoa-soft">Color principal</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-2xl border-2 border-cocoa/10 bg-cream p-1"
                aria-label="Color principal"
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-bold text-cocoa-soft">Color secundario</span>
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-2xl border-2 border-cocoa/10 bg-cream p-1"
                aria-label="Color secundario"
              />
            </div>
          </div>
          <Input label="Contacto" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Teléfono, correo…" />
          <Input
            label="Pie de reporte"
            value={reportFooter}
            onChange={(e) => setReportFooter(e.target.value)}
            placeholder="¡Gracias por tu compra!"
          />
        </div>
      </Card>

      {/* Precios */}
      <Card>
        <CardHeader title="Precios por defecto" subtitle="Se usan al registrar compras y ventas" />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Costo de compra (${currency})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
          />
          <Input
            label={`Precio de venta (${currency})`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={homePrice}
            onChange={(e) => setHomePrice(e.target.value)}
          />
        </div>
        <p className="mt-3 text-xs font-semibold text-cocoa-soft">
          Ganancia estimada por paleta:{" "}
          <span className="font-extrabold text-turquoise-deep">
            {formatMoney((Number(homePrice) || 0) - (Number(purchaseCost) || 0), currency)}
          </span>
        </p>
        <Button className="mt-4 w-full" onClick={handleSaveSettings} disabled={saving}>
          {saving ? "Guardando…" : "Guardar ajustes"}
        </Button>
      </Card>

      {/* Ubicaciones */}
      <Card>
        <CardHeader
          title="Ubicaciones de venta"
          subtitle="Dónde vendes tus paletas"
          action={
            <button
              type="button"
              onClick={() => setLocationModal(true)}
              className="flex min-h-10 items-center gap-1 rounded-full bg-turquoise/12 px-3 text-sm font-bold text-turquoise-deep"
            >
              <IconPlus className="h-4 w-4" /> Agregar
            </button>
          }
        />
        <ul className="flex flex-wrap gap-2">
          {(locations.data ?? []).map((loc) => (
            <li
              key={loc.id}
              className="rounded-full bg-cream px-4 py-2 text-sm font-bold text-cocoa ring-1 ring-cocoa/10"
            >
              {loc.name}
            </li>
          ))}
          {locations.data && locations.data.length === 0 ? (
            <li className="text-sm text-cocoa-soft">Sin ubicaciones todavía.</li>
          ) : null}
        </ul>
      </Card>

      {/* Sabores */}
      <Card>
        <CardHeader
          title="Sabores"
          subtitle="Agrega nuevos sabores a tu catálogo"
          action={
            <button
              type="button"
              onClick={() => setFlavorModal(true)}
              className="flex min-h-10 items-center gap-1 rounded-full bg-turquoise/12 px-3 text-sm font-bold text-turquoise-deep"
            >
              <IconPlus className="h-4 w-4" /> Agregar
            </button>
          }
        />
        <ul className="flex flex-wrap gap-2">
          {(flavors.data ?? []).map((flavor) => (
            <li
              key={flavor.id}
              className="rounded-full bg-cream px-4 py-2 text-sm font-bold text-cocoa ring-1 ring-cocoa/10"
            >
              {flavor.emoji ?? "🍦"} {flavor.name}
              {!flavor.active ? <span className="ml-1 text-xs text-cocoa-soft">(inactivo)</span> : null}
            </li>
          ))}
          {flavors.data && flavors.data.length === 0 ? (
            <li className="text-sm text-cocoa-soft">Sin sabores todavía.</li>
          ) : null}
        </ul>
      </Card>

      {/* Modal nueva ubicación */}
      <Modal
        open={locationModal}
        onClose={() => setLocationModal(false)}
        title="Nueva ubicación"
        footer={
          <Button className="w-full" onClick={handleAddLocation} disabled={!newLocation.trim()}>
            Agregar ubicación
          </Button>
        }
      >
        <Input
          label="Nombre"
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          placeholder="Ej. Parque central"
          autoFocus
        />
      </Modal>

      {/* Modal nuevo sabor */}
      <Modal
        open={flavorModal}
        onClose={() => setFlavorModal(false)}
        title="Nuevo sabor"
        footer={
          <Button className="w-full" onClick={handleAddFlavor} disabled={!newFlavor.trim()}>
            Agregar sabor
          </Button>
        }
      >
        <Input
          label="Nombre del sabor"
          value={newFlavor}
          onChange={(e) => setNewFlavor(e.target.value)}
          placeholder="Ej. Tamarindo"
          autoFocus
        />
      </Modal>
    </div>
  );
}
