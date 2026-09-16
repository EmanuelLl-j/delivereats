import { AudioSession, AndroidAudioTypePresets, registerGlobals } from '@livekit/react-native';
import { Room, RoomEvent } from 'livekit-client';
registerGlobals();
export async function connectAudio(url: string, token: string, changed: (state: string) => void, signal?: AbortSignal) {
  const room = new Room({ adaptiveStream: false, dynacast: false });
  room.on(RoomEvent.ConnectionStateChanged, state => changed(state));
  const checkCancelled = () => { if (signal?.aborted) throw new Error('Conexión de audio cancelada'); };
  const abort = () => { void room.disconnect().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });
  checkCancelled();
  try {
    await AudioSession.configureAudio({ android: { audioTypeOptions: AndroidAudioTypePresets.communication, preferredOutputList: ['bluetooth', 'headset', 'earpiece', 'speaker'] }, ios: { defaultOutput: 'earpiece' } });
    checkCancelled();
    await AudioSession.startAudioSession();
    checkCancelled();
    await room.connect(url, token); checkCancelled();
    await room.localParticipant.setMicrophoneEnabled(true); checkCancelled();
  } catch (error) { signal?.removeEventListener('abort', abort); await room.disconnect(); await AudioSession.stopAudioSession(); throw error; }
  return {
    mute: (muted: boolean) => room.localParticipant.setMicrophoneEnabled(!muted),
    speaker: (enabled: boolean) => AudioSession.selectAudioOutput(enabled ? 'speaker' : 'earpiece'),
    close: async () => { signal?.removeEventListener('abort', abort); await room.disconnect(); await AudioSession.stopAudioSession(); },
  };
}
