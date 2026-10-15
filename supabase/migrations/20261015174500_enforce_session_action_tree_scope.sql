ALTER TABLE public.session_actions
  ADD CONSTRAINT session_actions_parent_scope_unique
  UNIQUE (id, session_id, goal_id, user_id);

ALTER TABLE public.session_actions
  ADD CONSTRAINT session_actions_parent_same_session_fkey
  FOREIGN KEY (parent_action_id, session_id, goal_id, user_id)
  REFERENCES public.session_actions (id, session_id, goal_id, user_id)
  ON DELETE CASCADE;
