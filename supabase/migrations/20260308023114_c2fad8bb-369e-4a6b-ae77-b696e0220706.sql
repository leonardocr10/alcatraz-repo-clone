CREATE POLICY "Admins can delete any user"
ON public.users
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));