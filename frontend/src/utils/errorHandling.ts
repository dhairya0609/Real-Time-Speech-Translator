export function isBrowserSupported(): boolean {
    return !!(window.MediaDevices && window.MediaRecorder && window.WebSocket && window.AudioContext);
  }
  
  export async function getMicrophonePermission(): Promise<boolean> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false;
    }
  }