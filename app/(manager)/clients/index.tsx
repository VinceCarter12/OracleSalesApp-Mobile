// Manager My Clients uses the real scoped team screen rather than the
// Sales-only local hook. `more/clients` keeps the Sales-style search/cards for
// My Records and adds the Manager's mine/team/combined remote scope path.
// The dashboard's Clients action remains on this route group, while the More
// tile continues to point at the same implementation.
export { default } from '../more/clients/index';
