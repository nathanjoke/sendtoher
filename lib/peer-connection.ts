export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(process.env.NEXT_PUBLIC_TURN_URL
      ? [
          {
            urls: process.env.NEXT_PUBLIC_TURN_URL,
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
};

export function createPeerConnection(
  onSignal: (data: RTCSessionDescriptionInit | RTCIceCandidateInit) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onSignal(event.candidate.toJSON());
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };

  return pc;
}

export async function addRemoteCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit,
) {
  await pc.addIceCandidate(candidate);
}
