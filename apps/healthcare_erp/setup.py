from setuptools import find_packages, setup

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

with open("healthcare_erp/__init__.py") as f:
	for line in f:
		if line.startswith("__version__"):
			version = line.split("=")[1].strip().strip('"').strip("'")
			break

setup(
	name="healthcare_erp",
	version=version,
	description="Custom Healthcare Management System app extending ERPNext Healthcare for Health-C Medical Center",
	author="Health-C",
	author_email="engineering@health-c.local",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires,
)
