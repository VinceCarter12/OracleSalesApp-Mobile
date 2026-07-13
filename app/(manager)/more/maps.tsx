import { Map } from 'lucide-react-native';
import { COLORS } from '../../../lib/theme';
import { PlaceholderNotice } from '../../../components/ui/PlaceholderNotice';

/** Wireframe s-maps — placeholder, pending client confirmation per June 24 + Jul 10 meetings. */
export default function ManagerMapsScreen() {
  return (
    <PlaceholderNotice
      screenTitle="Maps"
      icon={<Map size={40} color={COLORS.hare} />}
      body={'Per June 24 meeting, ang maps ay tinanggal sa mobile agent side — web dashboard (Manager/Admin) ang may hawak nito para sa pag-verify ng meeting locations.\n\nUpdate Jul 10: gusto ng client na may mukha ng handling agent ang map pins ("legend") — web-side ito at kay Guanez ang implementation, hindi sa mobile repo. Tandaan din (ADR-012): ang GPS ng online meetings ay lokasyon ng agent, hindi ng client — hindi dapat i-plot bilang client-site visit.'}
    />
  );
}
