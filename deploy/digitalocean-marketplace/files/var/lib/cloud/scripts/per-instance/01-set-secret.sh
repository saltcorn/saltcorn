pg_pass=$(openssl rand -base64 16)
session_secret=$(openssl rand -base64 16)
sudo -iu postgres psql -U postgres -c "ALTER USER saltcorn WITH PASSWORD '${pg_pass}';"

cat <<EOF > /home/saltcorn/.config/.saltcorn
{
    "host":"localhost",
    "port":5432,
    "database":"saltcorn",
    "user":"saltcorn",
    "password":"${pg_pass}",
    "session_secret":"${session_secret}"
}
EOF
chown saltcorn:saltcorn /home/saltcorn/.config/.saltcorn
chmod 600 /home/saltcorn/.config/.saltcorn
systemctl daemon-reload
systemctl start saltcorn
systemctl enable saltcorn