import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { api } from './api';

export type UploadedAsset = { id: string; url?: string; mimeType: string; size: number };
export async function uploadAsset(purpose: string, camera = false): Promise<UploadedAsset | null> {
  let uri: string, name: string, type: string, size: number | undefined;
  if (camera) {
    if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Permite el acceso a la cámara para registrar la evidencia.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (result.canceled) return null;
    const asset = result.assets[0]!;
    uri = asset.uri; name = asset.fileName ?? 'evidencia.jpg'; type = asset.mimeType ?? 'image/jpeg'; size = asset.fileSize;
  } else {
    const result = await DocumentPicker.getDocumentAsync({ type: purpose.endsWith('_DOCUMENT') ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] : ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return null;
    const asset = result.assets[0]!;
    uri = asset.uri; name = asset.name; type = asset.mimeType ?? 'application/octet-stream'; size = asset.size;
  }
  if (size && size > 8 * 1024 * 1024) throw new Error('El archivo no debe superar 8 MB.');
  const form = new FormData();
  if (Platform.OS === 'web') form.append('file', await (await fetch(uri)).blob(), name);
  else form.append('file', { uri, name, type } as unknown as Blob);
  return api<UploadedAsset>('/users/files?purpose=' + encodeURIComponent(purpose), { method: 'POST', body: form });
}

