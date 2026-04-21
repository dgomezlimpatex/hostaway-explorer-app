import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, MapPin, Users, MessageSquare, Camera, Loader2, Lock,
  CheckCircle2, Clock, ImageOff, X,
} from 'lucide-react';
import { PortalBooking } from '@/types/clientPortal';
import { useClientPortalTaskReport } from '@/hooks/useClientPortal';
import { cn } from '@/lib/utils';

interface ReservationDetailModalProps {
  booking: PortalBooking | null;
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReservationDetailModal = ({
  booking,
  clientId,
  open,
  onOpenChange,
}: ReservationDetailModalProps) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: reportData, isLoading } = useClientPortalTaskReport(
    booking?.taskId,
    clientId,
  );

  // Reset lightbox when switching bookings or closing modal
  useEffect(() => {
    setLightboxIndex(null);
  }, [booking?.id, open]);

  if (!booking) return null;

  const cleaningDate = new Date(booking.cleaningDate);
  const isCompleted = booking.taskStatus === 'completed' || reportData?.status === 'ready';
  const isExternal = booking.source === 'external';
  const photos = (reportData?.media ?? []).filter(m => m.media_type === 'photo');
  const photosDisabled = reportData?.status === 'photos_disabled';

  const renderStatusBadge = () => {
    if (booking.taskStatus === 'completed') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Completada
        </Badge>
      );
    }
    if (booking.taskStatus === 'in_progress') {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" /> En progreso
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Clock className="h-3 w-3 mr-1" /> Pendiente
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                  <span className="truncate">
                    {booking.property?.codigo || booking.property?.nombre || 'Propiedad'}
                  </span>
                  {isExternal && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Sincronizada
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-2 flex-wrap">
                  {booking.property?.nombre && booking.property?.codigo && (
                    <span className="text-xs text-muted-foreground">
                      {booking.property.nombre}
                    </span>
                  )}
                </DialogDescription>
              </div>
              {renderStatusBadge()}
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Fecha de limpieza"
                value={format(cleaningDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
              />
              {booking.checkInDate && booking.checkOutDate && (
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Estancia"
                  value={`${format(new Date(booking.checkInDate), 'd MMM', { locale: es })} → ${format(new Date(booking.checkOutDate), 'd MMM yyyy', { locale: es })}`}
                />
              )}
              {booking.property?.direccion && (
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Dirección"
                  value={booking.property.direccion}
                />
              )}
              {booking.guestCount != null && (
                <InfoRow
                  icon={<Users className="h-4 w-4" />}
                  label="Huéspedes"
                  value={`${booking.guestCount}`}
                />
              )}
              {booking.specialRequests && (
                <InfoRow
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="Notas"
                  value={booking.specialRequests}
                  className="sm:col-span-2"
                />
              )}
            </div>

            {/* Photo gallery section - hide entirely if photos disabled for this client */}
            {!photosDisabled && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Camera className="h-4 w-4" />
                  Reporte de la limpieza
                </h3>

                {isLoading && (
                  <div className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Cargando reporte...</p>
                  </div>
                )}

                {!isLoading && reportData?.status === 'not_ready' && (
                  <div className="py-6 text-center bg-muted/30 rounded-lg border border-dashed">
                    <ImageOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                      {isCompleted
                        ? 'El reporte fotográfico aún no está disponible.'
                        : 'El reporte estará disponible cuando el equipo termine la limpieza.'}
                    </p>
                  </div>
                )}

                {!isLoading && reportData?.status === 'ready' && photos.length === 0 && (
                  <div className="py-6 text-center bg-muted/30 rounded-lg border border-dashed">
                    <ImageOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">
                      El equipo ha completado la limpieza pero no se han subido fotos.
                    </p>
                  </div>
                )}

                {!isLoading && reportData?.status === 'ready' && photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {photos.map((photo, i) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="group relative aspect-square overflow-hidden rounded-lg border bg-muted hover:ring-2 hover:ring-primary transition-all"
                      >
                        <img
                          src={photo.file_url}
                          alt={photo.description || `Foto ${i + 1}`}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            aria-label="Cerrar"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={photos[lightboxIndex].file_url}
            alt={photos[lightboxIndex].description || `Foto ${lightboxIndex + 1}`}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white text-sm bg-black/50 px-3 py-1.5 rounded-full">
              {lightboxIndex + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

const InfoRow = ({
  icon, label, value, className,
}: { icon: React.ReactNode; label: string; value: string; className?: string }) => (
  <div className={cn('flex items-start gap-2', className)}>
    <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  </div>
);
