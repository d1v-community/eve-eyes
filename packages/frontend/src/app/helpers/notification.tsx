import { Link } from '@radix-ui/themes'
import toast, { Renderable, type Toast } from 'react-hot-toast'
import Notification, { type NotificationTone } from '../components/Notification'

function renderNotification(type: NotificationTone, message: Renderable) {
  return (toastInstance: Toast) => (
    <Notification toastInstance={toastInstance} type={type}>
      {message}
    </Notification>
  )
}

function showNotification(
  type: NotificationTone,
  message: Renderable,
  options?: {
    id?: string
    duration?: number
  }
) {
  return toast.custom(renderNotification(type, message), {
    id: options?.id,
    duration:
      options?.duration ?? (type === 'loading' ? Number.POSITIVE_INFINITY : 4000),
  })
}

const reportLoading = (message: Renderable) => {
  return showNotification('loading', message)
}

const reportError = (
  error: Error | null,
  userFriendlyMessage?: string | null,
  id?: string
) => {
  if (error != null) {
    console.error(error)
  }

  const message = userFriendlyMessage || error?.message || 'An error has occurred'

  return showNotification('error', message, {
    id: id ?? Date.now().toString(),
    duration: 5000,
  })
}

const reportSuccess = (message: Renderable, id?: string) => {
  return showNotification('success', message, {
    id: id ?? Date.now().toString(),
    duration: 4000,
  })
}

const reportTxLoading = () => {
  return reportLoading('Confirm this transaction in your wallet')
}

const reportTxError = (
  error: Error | null,
  userFriendlyMessage?: string | null,
  id?: string
) => {
  return reportError(error, userFriendlyMessage, id)
}

const reportTxSuccess = (transactionUrl: string, id?: string) => {
  return reportSuccess(
    <>
      Transaction submitted{' '}
      <Link target="_blank" rel="noopener noreferrer" href={transactionUrl}>
        (view)
      </Link>
    </>,
    id
  )
}

export const notification = {
  loading: reportLoading,
  success: reportSuccess,
  error: reportError,
  txLoading: reportTxLoading,
  txSuccess: reportTxSuccess,
  txError: reportTxError,
}
