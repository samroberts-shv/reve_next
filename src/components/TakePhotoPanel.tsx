import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import closeGlyph from '../assets/glyphs/close.svg'

type TakePhotoPanelProps = {
  isOpen: boolean
  onClose: () => void
  onCapture: (dataUrl: string) => void
}

async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'videoinput')
}

function formatDeviceLabel(label: string, fallback: string): string {
  const cleaned = label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*$/, '').trim()
  return cleaned || fallback
}

function TakePhotoPanel({ isOpen, onClose, onCapture }: TakePhotoPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streamReady, setStreamReady] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStreamReady(false)
  }, [])

  const startStream = useCallback(
    async (deviceId?: string) => {
      stopStream()
      setError(null)
      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        setStreamReady(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not access camera')
      }
    },
    [stopStream],
  )

  useEffect(() => {
    if (!isOpen) {
      stopStream()
      return
    }

    let cancelled = false

    const init = async () => {
      await startStream()
      if (cancelled || !streamRef.current) return
      const videoDevices = await getVideoDevices()
      if (cancelled) return
      setDevices(videoDevices)
      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId)
      }
    }

    void init()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [isOpen, startStream, stopStream])

  useEffect(() => {
    if (isOpen && selectedDeviceId && devices.length > 1) {
      void startStream(selectedDeviceId)
    }
  }, [isOpen, selectedDeviceId, devices.length, startStream])

  useEffect(() => {
    if (!streamReady || !streamRef.current || !videoRef.current) return
    const video = videoRef.current
    const stream = streamRef.current
    video.srcObject = stream
    video.play().catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not play video')
    })
  }, [streamReady])

  const handleCapture = useCallback(() => {
    const video = videoRef.current
    if (!video || !streamRef.current || video.readyState < 2) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    onCapture(dataUrl)
    onClose()
  }, [onCapture, onClose])

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value || null
    setSelectedDeviceId(deviceId)
  }

  if (!isOpen) return null

  const content = (
    <>
      <div
        className="take-photo-backdrop"
        aria-hidden="true"
        onClick={onClose}
        onPointerDown={(e) => e.preventDefault()}
      />
      <section
        className="take-photo-panel"
        style={{ width: `${window.innerWidth * 0.75}px` }}
        aria-label="Take a photo"
      >
        <button
          type="button"
          className="take-photo-close-button"
          aria-label="Close"
          onClick={onClose}
        >
          <img src={closeGlyph} alt="" aria-hidden="true" />
        </button>

        <div className="take-photo-video-container">
          {error ? (
            <p className="take-photo-error">{error}</p>
          ) : (
            <video
              ref={videoRef}
              className="take-photo-video"
              autoPlay
              playsInline
              muted
              aria-label="Camera preview"
            />
          )}
        </div>

        <div className="take-photo-controls">
          <div className="take-photo-camera-select-wrap">
            <select
              id="take-photo-camera-select"
              aria-label="Camera"
              className="take-photo-camera-select"
              value={selectedDeviceId ?? ''}
              onChange={handleDeviceChange}
              disabled={devices.length <= 1}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {formatDeviceLabel(device.label, `Camera ${devices.indexOf(device) + 1}`)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="take-photo-capture-button"
            aria-label="Capture photo"
            onClick={handleCapture}
            disabled={!!error}
          />
        </div>
      </section>
    </>
  )

  return createPortal(content, document.body)
}

export default TakePhotoPanel
