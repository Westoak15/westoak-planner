import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { ChevronRight, Users, User, ArrowLeft, FileText } from "lucide-react";
import { initials, avatarBg } from "../lib/utils";

interface FaUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  agentId: string | null;
  agency: string | null;
  phone: string | null;
  level: "standard" | "enhanced";
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  province: string | null;
  annualIncome: string | null;
}

interface Plan {
  id: number;
  name: string;
  status: string;
  createdAt: string;
}

type View = "agents" | "clients" | "plans";

export function AgentsTab({ onSelectClient }: { onSelectClient?: (clientId: number, planId: number | null) => void }) {
  const [view, setView]           = useState<View>("agents");
  const [agents, setAgents]       = useState<FaUser[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<FaUser | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get<FaUser[]>("/api/auth/users").then(setAgents).finally(() => setLoading(false));
  }, []);

  function selectAgent(agent: FaUser) {
  setSelectedAgent(agent);
  setLoading(true);
  api.get<Client[]>(`/api/clients?agentId=${agent.id}`)
    .then(setClients)
    .finally(() => setLoading(false));
  setView("clients");
}

  function selectClient(client: Client) {
    setSelectedClient(client);
    setLoading(true);
    api.get<Plan[]>(`/api/clients/${client.id}/plans`).then(setPlans).finally(() => setLoading(false));
    setView("plans");
  }

  function backToAgents() {
    setView("agents");
    setSelectedAgent(null);
    setClients([]);
  }

  function backToClients() {
    setView("clients");
    setSelectedClient(null);
    setPlans([]);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button onClick={backToAgents} className={view === "agents" ? "font-bold text-gray-900" : "hover:text-gray-600"}>
          Agents
        </button>
        {selectedAgent && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <button onClick={backToClients} className={view === "clients" ? "font-bold text-gray-900" : "hover:text-gray-600"}>
              {selectedAgent.firstName} {selectedAgent.lastName}
            </button>
          </>
        )}
        {selectedClient && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-gray-900">{selectedClient.firstName} {selectedClient.lastName}</span>
          </>
        )}
      </div>

      {/* Agents list */}
      {view === "agents" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Field Agents</h1>
            <span className="text-sm text-gray-400">{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No field agents yet</p>
              <p className="text-sm text-gray-400 mt-1">Create agents in the Admin tab</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {agents.map((agent, i) => (
                <button key={agent.id} onClick={() => selectAgent(agent)}
                  className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${avatarBg(agent.firstName + agent.lastName)} flex items-center justify-center text-white text-sm font-bold`}>
                      {initials(agent.firstName, agent.lastName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{agent.firstName} {agent.lastName}</p>
                      <p className="text-xs text-gray-400">{agent.email}{agent.agentId ? ` · ${agent.agentId}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${agent.level === "enhanced" ? "bg-cyan-100 text-cyan-700" : "bg-gray-100 text-gray-600"}`}>
                      {agent.level === "enhanced" ? "Enhanced" : "Standard"}
                    </span>
                    {agent.agency && <span className="text-xs text-gray-400">{agent.agency}</span>}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Clients list */}
      {view === "clients" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedAgent?.firstName}'s Clients
            </h1>
            <span className="text-sm text-gray-400">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No clients yet</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {clients.map((client, i) => (
                <button key={client.id} onClick={() => selectClient(client)}
                  className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${avatarBg(client.firstName + client.lastName)} flex items-center justify-center text-white text-sm font-bold`}>
                      {initials(client.firstName, client.lastName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{client.firstName} {client.lastName}</p>
                      <p className="text-xs text-gray-400">{client.email ?? ""}{client.province ? ` · ${client.province}` : ""}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Plans list */}
      {view === "plans" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedClient?.firstName} {selectedClient?.lastName}'s Plans
            </h1>
            <span className="text-sm text-gray-400">{plans.length} plan{plans.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No plans yet</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {plans.map((plan, i) => (
                <button key={plan.id} onClick={() => onSelectClient?.(selectedClient!.id, plan.id)}
                  className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-400">{new Date(plan.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${plan.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {plan.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
