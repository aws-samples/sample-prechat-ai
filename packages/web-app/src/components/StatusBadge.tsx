// nosemgrep
import { Badge } from '@cloudscape-design/components'

interface StatusBadgeProps {
  status: string
  type?: 'session' | 'agent'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'session' }) => {
  if (type === 'session') {
    switch (status) {
      case 'active':
        return <Badge color="blue">Active</Badge>
      case 'completed':
        return <Badge color="green">Completed</Badge>
      case 'expired':
        return <Badge color="red">Expired</Badge>
      case 'inactive':
        return <Badge color="grey">Inactive</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (type === 'agent') {
    switch (status) {
      case 'PREPARED':
        return <Badge color="green">Prepared</Badge>
      case 'PREPARING':
        return <Badge color="blue">Preparing</Badge>
      case 'NOT_PREPARED':
        return <Badge color="grey">Not Prepared</Badge>
      case 'CREATING':
        return <Badge color="blue">Creating</Badge>
      case 'UPDATING':
        return <Badge color="blue">Updating</Badge>
      case 'DELETING':
        return <Badge color="red">Deleting</Badge>
      case 'FAILED':
        return <Badge color="red">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return <Badge>{status}</Badge>
}