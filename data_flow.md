Browser CSV upload
    │
    ▼
normalizeTo254()           ← client-side clean
    │
    ▼
POST /contacts/api/contacts     or    PUT /contacts/api/groups/:id/contacts
{ groupId, contacts }                  { contacts }
    │
    ▼ Node middleware
{ group_id, contacts }                 PUT /api/v1/contacts/group/:id  { contacts }
    │
    ▼ Go handler
AddContacts()                          UpdateContactGroup()
  insert phonebook                       verify ownership
  insert address book                    delete old members
  insert group members                   insert new members