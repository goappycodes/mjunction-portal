import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewUserForm, UsersTable } from "./users-client";
import { Input } from "@/components/ui/primitives";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { FormSearchableSelect } from "@/components/ui/form-searchable-select";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/page-header";
import { buildQuery } from "@/lib/utils";
import type { UserRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const BASE = "/admin/users";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const sort = sp.sort ?? "recent";

  let query = supabase.from("profiles").select("*", { count: "exact" });
  if (sp.role === "admin" || sp.role === "telecaller") {
    query = query.eq("role", sp.role as UserRole);
  }
  if (sp.q) query = query.ilike("full_name", `%${sp.q}%`);
  query =
    sort === "name"
      ? query.order("full_name", { ascending: true })
      : query.order("created_at", { ascending: false });
  const { data: users, count } = await query.range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & roles"
        description="Admins manage everything; telecallers handle escalations, retries and manual calls."
      />
      <NewUserForm />
      <FilterBar action="/admin/users" resetHref="/admin/users">
        <FilterField label="Search">
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Name"
            className="w-56"
          />
        </FilterField>
        <FilterField label="Role">
          <FormSearchableSelect
            name="role"
            defaultValue={sp.role ?? ""}
            allLabel="All roles"
            className="w-40"
            options={[
              { value: "admin", label: "Admin" },
              { value: "telecaller", label: "Telecaller" },
            ]}
          />
        </FilterField>
        <FilterField label="Sort by">
          <FormSearchableSelect
            name="sort"
            defaultValue={sort}
            className="w-44"
            options={[
              { value: "recent", label: "Newest first" },
              { value: "name", label: "Name (A–Z)" },
            ]}
          />
        </FilterField>
      </FilterBar>
      <UsersTable users={users ?? []} selfId={admin.id} />
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) =>
          buildQuery(BASE, { role: sp.role, q: sp.q, sort: sp.sort, page: p })
        }
      />
    </div>
  );
}
