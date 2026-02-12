import { useState, useEffect } from "react";

import { AllocationGroupManager } from "@/components/AllocationGroupManager";
import { AllocationAnalysisCard } from "@/components/AllocationAnalysisCard";
import { getAllocationGroups } from "@/api/allocation-groups";
import type { AllocationGroup } from "@/types/allocation-groups";

export function AllocationGroupsPage() {
  const [groups, setGroups] = useState<AllocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const data = await getAllocationGroups();
      setGroups(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Allocation Groups</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create groups to track target allocations and get rebalancing suggestions.
        </p>
      </div>

      {/* Group Manager */}
      <AllocationGroupManager onGroupsChange={loadGroups} />

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Loading */}
      {loading && <p className="text-sm text-muted-foreground">Loading groups...</p>}

      {/* Empty state */}
      {!loading && groups.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            No allocation groups yet. Create one above to get started.
          </p>
        </div>
      )}

      {/* Analysis cards */}
      {!loading && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => (
            <AllocationAnalysisCard
              key={group.id}
              groupId={group.id}
              groupName={group.name}
              groupColor={group.color}
              onUpdate={loadGroups}
            />
          ))}
        </div>
      )}
    </div>
  );
}
