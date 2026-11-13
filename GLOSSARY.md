# Slack Bill Splitting

Splitting a shared expense among a group of Slack users, and tracking who has paid back the person who paid upfront.

## Language

### Bills

**Bill**:
A shared expense posted to a channel, to be split among its Participants.
_Avoid_: Receipt (a receipt is only the source image a Bill may be created from)

**Equal Split**:
A Bill whose total is divided evenly across all Participants.

**Item-based Split**:
A Bill whose total is made up of Items, where each Participant owes for the Items they select.
_Avoid_: Custom amounts

**Item**:
One line on an Item-based Bill, with a name and a cost. Service charges and taxes are ordinary Items, not a separate kind of cost.
_Avoid_: Surcharge

**Selection**:
A Participant's declaration of which Items they owe for. An Item selected by several Participants has its cost divided equally among them.

**Unselected Item**:
An Item that no Participant selected. Its cost is absorbed by the Creator, and this is shown openly rather than silently dropped.

**Finalize Shares**:
The Creator's act of turning everyone's Selections into Shares, which moves an Item-based Bill from Awaiting Selection to Active.
_Avoid_: Complete Calculation, complete

### Bill lifecycle

**Awaiting Selection**:
An Item-based Bill whose Participants are still making their Selections. Equal Split Bills skip this state.
_Avoid_: Pending

**Active**:
A Bill whose Shares are fixed and whose Participants are paying them back.

**Completed**:
A Bill on which every Participant is Paid.
_Avoid_: Finalized, done

**Cancelled**:
A Bill the Creator withdrew before it was Completed.

### Participant payment status

**Unpaid**:
A Participant who has not yet claimed to have paid their Share, or whose claim was rejected.

**Awaiting Confirmation**:
A Participant who says they paid their Share, waiting for the Creator to confirm or reject it.
_Avoid_: Pending

**Paid**:
A Participant whose payment the Creator has confirmed. The Creator is always Paid.

### People and money

**Participant**:
A person included on a Bill who owes a Share of it. The Creator is always a Participant.

**Creator**:
The person who paid the expense upfront and created the Bill to collect it back; paying and creating are always done by the same person. The Creator is never asked to pay themselves.
_Avoid_: Bill owner, owner, payer

**Share**:
The amount one Participant owes on a Bill. The Shares of all Participants always add up exactly to the Bill total: every other Participant's Share is rounded down to the satang, and any remainder falls to the Creator.
_Avoid_: Amount, owed amount
