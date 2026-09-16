import { Room, RoomEvent, Track } from 'livekit-client';
export async function connectAudio(url: string, token: string, changed: (state: string) => void, signal?: AbortSignal) {
  const room = new Room({ adaptiveStream: false, dynacast: false });
  const elements = new Set<HTMLMediaElement>();
  room.on(RoomEvent.ConnectionStateChanged, state => changed(state));
  room.on(RoomEvent.TrackSubscribed, track => {
    if (track.kind !== Track.Kind.Audio) return;
    const element = track.attach(); element.autoplay = true; document.body.appendChild(element); elements.add(element);
  });
  room.on(RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(element => { elements.delete(element); element.remove(); }); });
  const checkCancelled = () => { if (signal?.aborted) throw new Error('Conexión de audio cancelada'); };
  const abort = () => { void room.disconnect().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });
  checkCancelled();
  try { await room.connect(url, token); checkCancelled(); await room.startAudio(); checkCancelled(); await room.localParticipant.setMicrophoneEnabled(true); checkCancelled(); }
  catch (error) { signal?.removeEventListener('abort', abort); await room.disconnect(); elements.forEach(element => element.remove()); throw error; }
  return {
    mute: (muted: boolean) => room.localParticipant.setMicrophoneEnabled(!muted),
    speaker: async (_enabled: boolean) => { throw new Error('Selecciona la salida de audio desde los controles del navegador o sistema.'); },
    close: async () => { signal?.removeEventListener('abort', abort); await room.disconnect(); elements.forEach(element => element.remove()); },
  };
}
