import AdvisorRequestModal from '../../features/advisor/AdvisorRequestModal'
import ContactAdvisorModal from '../../features/advisor/ContactAdvisorModal'
import ResolveAdvisorRequestModal from '../../features/advisor/ResolveAdvisorRequestModal'
import CreateClubModal from '../../features/clubs/CreateClubModal'
import CreateEventModal from '../../features/events/CreateEventModal'

export default function DashboardModals({
  clubs,
  editingClub,
  editingEvent,
  onAdvisorRequestCreated,
  onClubSaved,
  onCloseAdvisorRequest,
  onCloseContactAdvisor,
  onCloseResolution,
  onCloseClub,
  onCloseEvent,
  onDeleteClub,
  onEventSaved,
  onRequestResolved,
  selectedAdvisorRequest,
  showAdvisorRequestModal,
  showContactAdvisorModal,
  showCreateClubModal,
  showCreateEventModal,
}) {
  return (
    <>
      {showCreateEventModal && (
        <CreateEventModal
          event={editingEvent}
          clubId={editingEvent?.clubId}
          clubs={clubs}
          onClose={onCloseEvent}
          onCreated={onEventSaved}
        />
      )}
      {showCreateClubModal && (
        <CreateClubModal
          club={editingClub}
          onClose={onCloseClub}
          onCreated={onClubSaved}
        />
      )}
      {showAdvisorRequestModal && (
        <AdvisorRequestModal
          isOpen={showAdvisorRequestModal}
          onClose={onCloseAdvisorRequest}
          clubs={clubs}
          onCreated={onAdvisorRequestCreated}
        />
      )}
      {showContactAdvisorModal && (
        <ContactAdvisorModal
          isOpen={showContactAdvisorModal}
          onClose={onCloseContactAdvisor}
          clubs={clubs}
        />
      )}
      {selectedAdvisorRequest && (
        <ResolveAdvisorRequestModal
          isOpen={Boolean(selectedAdvisorRequest)}
          onClose={onCloseResolution}
          request={selectedAdvisorRequest}
          onResolved={onRequestResolved}
          onDeleteClub={onDeleteClub}
        />
      )}
    </>
  )
}
